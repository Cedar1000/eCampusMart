import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { verifyPaystackTransaction } from 'utils/paystack';

import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import {
  Transaction,
  TransactionDescription,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { SubscriptionWebhookService } from './subscription-webhook.service';
import { WalletWebhookService } from './wallet-webhook.service';
import { asString } from './webhook.utils';

type PaymentPurpose = 'fund' | 'subscription';
type PaymentStatus = 'success' | 'pending' | 'failed';

interface Payment {
  purpose: PaymentPurpose;
  status: PaymentStatus;
  amount: number; // kobo
  expiresAt?: Date; // only top-ups expire as checkouts
}

// Paystack statuses that settle a payment; anything else (abandoned, ongoing,
// pending, …) means the user may still be paying
const PAYSTACK_FAILED = ['failed', 'reversed'];

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,

    private readonly walletWebhookService: WalletWebhookService,

    private readonly subscriptionWebhookService: SubscriptionWebhookService,
  ) {}

  // Settles a top-up or subscription payment straight away, in case the webhook is
  // late. Uses the same settlement code as the webhook, so it's credited once
  async verify(reference: string, userId: string) {
    let payment = await this.findOwnedPayment(reference, userId);

    if (payment.status === 'pending') {
      await this.settleWithPaystack(reference, payment);
      payment = await this.findOwnedPayment(reference, userId);
    }

    const wallet = await this.walletRepository.findOne({
      where: { userId },
      select: ['id', 'balance'],
    });

    return {
      status: 'success',
      data: {
        reference,
        purpose: payment.purpose,
        status: payment.status,
        // Stored in kobo, shown in naira
        amount: Number(payment.amount) / 100,
        balance: wallet ? Number(wallet.balance) / 100 : 0,
      },
    };
  }

  private async settleWithPaystack(reference: string, payment: Payment) {
    let data: Record<string, unknown>;

    try {
      data = await verifyPaystackTransaction(reference);
    } catch (error) {
      console.error('Paystack verification failed', reference, error);
      throw new BadGatewayException('Unable to verify payment');
    }

    const paystackStatus = asString(data.status);
    const settle = (event: string) =>
      payment.purpose === 'fund'
        ? this.walletWebhookService.handle(event, { ...data, reference })
        : this.subscriptionWebhookService.handle(event, {
            ...data,
            reference,
          });

    if (paystackStatus === 'success') return settle('charge.success');

    if (PAYSTACK_FAILED.includes(paystackStatus)) {
      return settle('charge.failed');
    }

    // Unpaid top-up checkouts close when they expire; a late payment is still credited
    if (payment.expiresAt && payment.expiresAt < new Date()) {
      return settle('charge.failed');
    }
  }

  // 404 if no payment has the reference, 403 if it isn't the user's
  private async findOwnedPayment(
    reference: string,
    userId: string,
  ): Promise<Payment> {
    const transaction = await this.transactionRepository.findOne({
      where: { reference, description: TransactionDescription.FUND },
      relations: ['wallet'],
    });

    if (transaction) {
      if (transaction.wallet?.userId !== userId) throw this.notYours();

      return {
        purpose: 'fund',
        status: this.transactionStatus(transaction.status),
        amount: transaction.amount,
        expiresAt: transaction.expiresAt,
      };
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { reference },
    });

    if (subscription) {
      if (subscription.userId !== userId) throw this.notYours();

      return {
        purpose: 'subscription',
        status: this.subscriptionStatus(subscription.status),
        amount: subscription.amount,
      };
    }

    throw new NotFoundException('No payment with that reference');
  }

  private notYours() {
    return new ForbiddenException('This payment is not yours');
  }

  private transactionStatus(status: TransactionStatus): PaymentStatus {
    if (status === TransactionStatus.SUCCESS) return 'success';
    if (status === TransactionStatus.FAILED) return 'failed';
    return 'pending';
  }

  // Every status past pending, except failed, means the first payment went through
  private subscriptionStatus(status: SubscriptionStatus): PaymentStatus {
    if (status === SubscriptionStatus.PENDING) return 'pending';
    if (status === SubscriptionStatus.FAILED) return 'failed';
    return 'success';
  }
}

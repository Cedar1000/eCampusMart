import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { verifyPaystackTransaction } from 'utils/paystack';

import { Subscription } from 'src/subscription/entities/subscription.entity';
import {
  Transaction,
  TransactionDescription,
} from 'src/transaction/entities/transaction.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { WebhookService } from './webhook.service';
import { asString } from './webhook.utils';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,

    private readonly webhookService: WebhookService,
  ) {}

  async verify(reference: string, userId: string) {
    const type = await this.getOwnedPaymentType(reference, userId);

    let data: Record<string, unknown>;

    try {
      data = await verifyPaystackTransaction(reference);
    } catch (error) {
      console.error('Paystack verification failed', error);
      throw new BadGatewayException('Unable to verify payment');
    }

    const paystackStatus = asString(data.status);

    // Settle it now in case the webhook hasn't arrived yet
    if (paystackStatus === 'success') {
      await this.webhookService.processEvent('charge.success', data);
    }

    if (paystackStatus === 'failed') {
      await this.webhookService.processEvent('charge.failed', data);
    }

    return {
      status: 'success',
      data: {
        reference,
        type,
        paymentStatus:
          paystackStatus === 'success' || paystackStatus === 'failed'
            ? paystackStatus
            : 'pending',
        // Paystack amounts are in kobo
        amount: Number(data.amount || 0) / 100,
        currency: asString(data.currency) || 'NGN',
      },
    };
  }

  private async getOwnedPaymentType(reference: string, userId: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { reference },
      select: ['id', 'walletId'],
    });

    if (transaction) {
      const ownsWallet = await this.walletRepository.exists({
        where: { id: transaction.walletId, userId },
      });

      if (ownsWallet) return TransactionDescription.FUND;
    }

    const ownsSubscription = await this.subscriptionRepository.exists({
      where: { reference, userId },
    });

    if (ownsSubscription) return TransactionDescription.STORE_SUBSCRIPTION;

    throw new NotFoundException('No payment with that reference');
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Transaction,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { DataSource, EntityManager } from 'typeorm';
import { PushService } from 'src/notification/push.service';
import { asString, PaystackEventData } from './webhook.utils';

// A failed top-up can still be paid later on the same reference (e.g. after it expired)
const UNPAID_STATUSES = [TransactionStatus.PENDING, TransactionStatus.FAILED];

/**
 * Settles wallet top-ups. The webhook and GET /payments/verify both go through here,
 * often for the same payment at the same time, so every change is a conditional
 * UPDATE: only the one that actually changes the row credits the wallet.
 */
@Injectable()
export class WalletWebhookService {
  constructor(
    private readonly dataSource: DataSource,

    private readonly pushService: PushService,
  ) {}

  async handle(event: string, data: PaystackEventData) {
    const reference = asString(data.reference);

    if (!reference) {
      throw new BadRequestException('Missing transaction reference');
    }

    if (event === 'charge.success') {
      await this.markTransactionSuccessful(reference, data);
    }

    if (event === 'charge.failed') {
      await this.markTransactionFailed(reference);
    }
  }

  // Credits the wallet once, and only if Paystack took the amount and currency we expect
  private async markTransactionSuccessful(
    reference: string,
    data: PaystackEventData,
  ) {
    const credited = await this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(Transaction, {
        where: { reference },
      });

      // Thrown so the webhook job retries, in case the row isn't committed yet
      if (!transaction) {
        throw new BadRequestException('Transaction not found');
      }

      if (transaction.status === TransactionStatus.SUCCESS) return null;

      if (!this.isPaidInFull(transaction, data)) return null;

      const marked = await manager
        .createQueryBuilder()
        .update(Transaction)
        .set({ status: TransactionStatus.SUCCESS })
        .where('reference = :reference AND status IN (:...unpaid)', {
          reference,
          unpaid: UNPAID_STATUSES,
        })
        .execute();

      // Someone else settled it between the read and the update
      if (!marked.affected) return null;

      const userId = await this.creditWallet(manager, transaction);
      return { userId, amount: Number(transaction.amount) };
    });

    // After the commit, and only by the call that credited it, so it's pushed once
    if (credited) {
      const naira = credited.amount / 100;

      await this.pushService.send([credited.userId], {
        title: 'Wallet funded',
        body: `₦${naira.toLocaleString('en-NG')} was added to your wallet`,
        data: { type: 'wallet-funded', reference, amount: naira },
      });
    }
  }

  // Returns the wallet owner's id
  private async creditWallet(manager: EntityManager, transaction: Transaction) {
    const amount = Number(transaction.amount);

    const result = await manager
      .createQueryBuilder()
      .update(Wallet)
      .set({ balance: () => 'balance + :amount' })
      .where('id = :walletId', { walletId: transaction.walletId })
      .setParameters({ amount })
      .returning(['balance', 'userId'])
      .execute();

    const [wallet] = result.raw as { balance: string; userId: string }[];

    if (!wallet) throw new BadRequestException('Wallet not found');

    // The balances stored at checkout are guesses; record the real ones
    const afterBalance = Number(wallet.balance);

    await manager.update(Transaction, transaction.id, {
      beforeBalance: afterBalance - amount,
      afterBalance,
    });

    return wallet.userId;
  }

  // Paystack amounts are in kobo, like ours
  private isPaidInFull(transaction: Transaction, data: PaystackEventData) {
    const paidAmount = Number(data.amount);
    const paidCurrency = asString(data.currency).toUpperCase();

    const matches =
      paidAmount === Number(transaction.amount) &&
      paidCurrency === transaction.currency.toUpperCase();

    if (!matches) {
      console.error('Top-up not credited: payment does not match', {
        reference: transaction.reference,
        expected: {
          amount: transaction.amount,
          currency: transaction.currency,
        },
        paid: { amount: data.amount, currency: data.currency },
      });
    }

    return matches;
  }

  private async markTransactionFailed(reference: string) {
    await this.dataSource
      .createQueryBuilder()
      .update(Transaction)
      .set({ status: TransactionStatus.FAILED })
      .where('reference = :reference AND status = :pending', {
        reference,
        pending: TransactionStatus.PENDING,
      })
      .execute();
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Transaction,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { DataSource, Repository } from 'typeorm';
import { asString, PaystackEventData } from './webhook.utils';

@Injectable()
export class WalletWebhookService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    private readonly dataSource: DataSource,
  ) {}

  async handle(event: string, data: PaystackEventData) {
    const reference = asString(data.reference);

    if (!reference) {
      throw new BadRequestException('Missing transaction reference');
    }

    if (event === 'charge.success') {
      await this.markTransactionSuccessful(reference);
    }

    if (event === 'charge.failed') {
      await this.markTransactionFailed(reference);
    }
  }

  private async markTransactionSuccessful(reference: string) {
    await this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(Transaction, {
        where: { reference },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transaction) {
        throw new BadRequestException('Transaction not found');
      }

      if (transaction.status === TransactionStatus.SUCCESS) {
        return;
      }

      const wallet = await manager.findOne(Wallet, {
        where: { id: transaction.walletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new BadRequestException('Wallet not found');

      transaction.status = TransactionStatus.SUCCESS;
      wallet.balance = Number(wallet.balance) + Number(transaction.amount);

      await manager.save(transaction);
      await manager.save(wallet);
    });
  }

  private async markTransactionFailed(reference: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { reference },
    });

    if (!transaction || transaction.status === TransactionStatus.SUCCESS) {
      return;
    }

    transaction.status = TransactionStatus.FAILED;
    await this.transactionRepository.save(transaction);
  }
}

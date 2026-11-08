import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { verifyPaystackTransaction } from 'utils/paystack';
import {
  Transaction,
  TransactionDescription,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entity';
import { WalletWebhookService } from './wallet-webhook.service';
import { asString } from './webhook.utils';

// Paystack is asked about each one, so a run is kept small
const BATCH = 50;

/**
 * Closes top-up checkouts that are still pending after expiresAt, so the ledger
 * and GET /transactions/verify agree without anyone calling verify. Paystack is
 * asked first: a paid one is credited (the webhook was missed), anything else is
 * marked failed. A payment that lands later is still credited by the webhook,
 * which accepts failed rows.
 */
@Injectable()
export class TopUpExpirySweep {
  private readonly logger = new Logger(TopUpExpirySweep.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,

    private readonly walletWebhookService: WalletWebhookService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweep(now = new Date()) {
    let expired: Pick<Transaction, 'reference'>[];

    try {
      expired = await this.transactionRepo.find({
        where: {
          description: TransactionDescription.FUND,
          status: TransactionStatus.PENDING,
          expiresAt: LessThan(now),
        },
        select: ['id', 'reference'],
        order: { expiresAt: 'ASC' },
        take: BATCH,
      });
    } catch (error) {
      this.logger.error('Top-up expiry sweep failed', error as Error);
      return;
    }

    for (const { reference } of expired) {
      try {
        const data = await this.lookUp(reference);
        const paid = asString(data.status) === 'success';

        await this.walletWebhookService.handle(
          paid ? 'charge.success' : 'charge.failed',
          { ...data, reference },
        );
      } catch (error) {
        // Left pending, so the next run tries again
        this.logger.error(`Top-up ${reference} not settled`, error as Error);
      }
    }
  }

  // A checkout Paystack never heard of (404) was never paid
  private async lookUp(reference: string): Promise<Record<string, unknown>> {
    try {
      return await verifyPaystackTransaction(reference);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return { status: 'failed' };
      }
      throw error;
    }
  }
}

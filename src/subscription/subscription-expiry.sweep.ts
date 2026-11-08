import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';

import { syncStoreVisibility } from 'src/service-store/store-visibility';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionStatus } from './enums/subscription-status.enum';

/**
 * Ends plans that were set not to renew (cancelled by the seller, or switched
 * away from) once their paid period is over, and takes the store off Explore
 * unless it has another plan. Paystack has already stopped billing them, and may
 * send nothing more.
 */
@Injectable()
export class SubscriptionExpirySweep {
  private readonly logger = new Logger(SubscriptionExpirySweep.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(now = new Date()) {
    try {
      const ended = await this.dataSource.manager.find(Subscription, {
        where: {
          status: SubscriptionStatus.NON_RENEWING,
          expiresAt: LessThan(now),
        },
        select: ['id', 'storeId'],
      });

      for (const { id, storeId } of ended) {
        await this.dataSource.transaction(async (manager) => {
          await manager.update(
            Subscription,
            { id, status: SubscriptionStatus.NON_RENEWING },
            { status: SubscriptionStatus.EXPIRED },
          );
          await syncStoreVisibility(manager, storeId);
        });
      }

      if (ended.length) this.logger.log(`Expired ${ended.length} plans`);
    } catch (error) {
      this.logger.error('Subscription expiry sweep failed', error as Error);
    }
  }
}

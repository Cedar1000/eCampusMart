import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In } from 'typeorm';

import { Subscription } from 'src/subscription/entities/subscription.entity';
import { ServiceStore } from './entities/service-store.entity';
import {
  isInFreeMonth,
  PAID_STATUSES,
  syncStoreVisibility,
} from './store-visibility';

// Free months end on a date, not on an event, so stores are re-checked on a schedule
@Injectable()
export class StoreVisibilitySweep implements OnApplicationBootstrap {
  private readonly logger = new Logger(StoreVisibilitySweep.name);

  constructor(private readonly dataSource: DataSource) {}

  // Also fixes stores opened before the free month was tracked
  onApplicationBootstrap() {
    void this.sweep();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweep() {
    try {
      const [stores, paid] = await Promise.all([
        this.dataSource.manager.find(ServiceStore, {
          select: [
            'id',
            'createdAt',
            'trialEndsAt',
            'trialCancelled',
            'hasActiveSubscription',
          ],
        }),
        this.dataSource.manager.find(Subscription, {
          where: { status: In(PAID_STATUSES) },
          select: ['storeId'],
        }),
      ]);

      const paidStoreIds = new Set(paid.map(({ storeId }) => storeId));

      const changed = stores.filter(
        (store) =>
          store.hasActiveSubscription !==
          (paidStoreIds.has(store.id) || isInFreeMonth(store)),
      );

      for (const { id } of changed) {
        await this.dataSource.transaction((manager) =>
          syncStoreVisibility(manager, id),
        );
      }

      if (changed.length) {
        this.logger.log(`Updated Explore listing for ${changed.length} stores`);
      }
    } catch (error) {
      this.logger.error('Store visibility sweep failed', error as Error);
    }
  }
}

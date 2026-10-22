import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceStoreService } from './service-store.service';
import { ServiceStoreController } from './service-store.controller';
import { ServiceStore } from './entities/service-store.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ValidServiceCategoryGuard } from './guards/valid-service-category.guard';
import { UniqueServiceStoreGuard } from './guards/unique-service-store.guard';
import { ValidServiceStoreOwnerGuard } from './guards/valid-service-store-owner.guard';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { StoreVisibilitySweep } from './store-visibility.sweep';
import { FreePlanReminderSweep } from './free-plan-reminder.sweep';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceStore,
      ServiceCategory,
      Subscription,
      SubscriptionPlan,
    ]),
  ],
  controllers: [ServiceStoreController],
  providers: [
    ServiceStoreService,
    ValidServiceCategoryGuard,
    UniqueServiceStoreGuard,
    ValidServiceStoreOwnerGuard,
    StoreVisibilitySweep,
    FreePlanReminderSweep,
  ],
  exports: [ServiceStoreService],
})
export class ServiceStoreModule {}

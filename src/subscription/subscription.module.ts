import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, ServiceStore, SubscriptionPlan]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
})
export class SubscriptionModule {}

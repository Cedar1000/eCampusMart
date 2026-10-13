import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WalletWebhookService } from './wallet-webhook.service';
import { SubscriptionWebhookService } from './subscription-webhook.service';
import { WebhookController } from './webhook.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { User } from 'src/auth/entities/user.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Wallet,
      Subscription,
      User,
      ServiceStore,
    ]),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, WalletWebhookService, SubscriptionWebhookService],
})
export class WebhookModule {}

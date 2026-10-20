import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WalletWebhookService } from './wallet-webhook.service';
import { SubscriptionWebhookService } from './subscription-webhook.service';
import { WebhookController } from './webhook.controller';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { User } from 'src/auth/entities/user.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { BullModule } from '@nestjs/bullmq';
import { PAYMENT_QUE } from './webhook.constants';
import { PaymentProcessor } from './processors/payment.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Wallet,
      Subscription,
      User,
      ServiceStore,
    ]),
    BullModule.registerQueue({ name: PAYMENT_QUE }),
  ],
  controllers: [WebhookController, PaymentController],
  providers: [
    WebhookService,
    WalletWebhookService,
    SubscriptionWebhookService,
    PaymentService,
    PaymentProcessor,
  ],
})
export class WebhookModule {}

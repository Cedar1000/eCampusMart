import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { getRedisOptions } from './redis/redis.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';

import { ProtectMiddleware } from './auth/middlewares/protect.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './auth/entities/user.entity';
import { DatabaseModule } from './database/database.module';
import { CampusModule } from './campus/campus.module';
import { ProductModule } from './product/product.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { ProductStoreModule } from './product-store/product-store.module';
import { ProductStoreCategoryModule } from './product-store-category/product-store-category.module';
import { ServiceCategoryModule } from './service-category/service-category.module';
import { ServiceStoreModule } from './service-store/service-store.module';
import { ServiceModule } from './service/service.module';
import { CampusLocationModule } from './campus-location/campus-location.module';
import { HousingModule } from './housing/housing.module';
import { WalletModule } from './wallet/wallet.module';
import { TransactionModule } from './transaction/transaction.module';
import { ProductFavouriteModule } from './product-favourite/product-favourite.module';
import { RedisModule } from './redis/redis.module';
import { ListingCleanupModule } from './common/listing-cleanup/listing-cleanup.module';
import { ServiceFavouriteModule } from './service-favourite/service-favourite.module';
import { ProductViewModule } from './product-view/product-view.module';
import { HousingFavouriteModule } from './housing-favourite/housing-favourite.module';
import { HousingViewModule } from './housing-view/housing-view.module';
import { ServiceViewModule } from './service-view/service-view.module';
import { SubscriptionPlanModule } from './subscription-plan/subscription-plan.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { WebhookModule } from './webhook/webhook.module';
import { UploadModule } from './upload/upload.module';
import { FeesModule } from './fees/fees.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      // Injecting ConfigService makes sure .env is loaded before reading it
      inject: [ConfigService],
      useFactory: () => ({ connection: getRedisOptions() }),
    }),
    DatabaseModule,
    AuthModule,
    CampusModule,
    TypeOrmModule.forFeature([User]),
    ProductModule,
    ProductCategoryModule,
    ProductStoreModule,
    ProductStoreCategoryModule,
    ServiceCategoryModule,
    ServiceStoreModule,
    ServiceModule,
    CampusLocationModule,
    HousingModule,
    WalletModule,
    TransactionModule,
    ProductFavouriteModule,
    RedisModule,
    ListingCleanupModule,
    ServiceFavouriteModule,
    ProductViewModule,
    HousingFavouriteModule,
    HousingViewModule,
    ServiceViewModule,
    SubscriptionPlanModule,
    SubscriptionModule,
    WebhookModule,
    UploadModule,
    FeesModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProtectMiddleware)
      .exclude(
        { path: 'auth/login/email', method: RequestMethod.POST },
        { path: 'auth/login/phone', method: RequestMethod.POST },
        { path: 'auth/signup', method: RequestMethod.POST },
        { path: 'auth/clerk', method: RequestMethod.POST },
        { path: 'auth/clerk/webhook', method: RequestMethod.POST },

        { path: 'auth/check-email', method: RequestMethod.POST },
        { path: 'auth/refresh-token', method: RequestMethod.POST },
        { path: 'auth/verify-otp', method: RequestMethod.POST },
        { path: 'auth/send-otp', method: RequestMethod.POST },
        { path: 'auth/reset-password/:token', method: RequestMethod.PATCH },
        { path: 'auth/create-password/:token', method: RequestMethod.PATCH },
        { path: 'subscription/webhook', method: RequestMethod.POST },
        { path: 'webhook/paystack', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}

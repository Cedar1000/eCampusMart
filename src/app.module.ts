import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { BullModule } from '@nestjs/bullmq';

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
import { ServiceFavouriteModule } from './service-favourite/service-favourite.module';
import { ProductViewModule } from './product-view/product-view.module';
import { HousingFavouriteModule } from './housing-favourite/housing-favourite.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
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
    ServiceFavouriteModule,
    ProductViewModule,
    HousingFavouriteModule,
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

        { path: 'auth/check-email', method: RequestMethod.POST },
        { path: 'auth/refresh-token', method: RequestMethod.POST },
        { path: 'auth/verify-otp', method: RequestMethod.POST },
        { path: 'auth/send-otp', method: RequestMethod.POST },
        { path: 'auth/reset-password/:token', method: RequestMethod.PATCH },
        { path: 'auth/create-password/:token', method: RequestMethod.PATCH },
        { path: 'subscription/webhook', method: RequestMethod.POST },
        { path: 'wallet/webhook/paystack', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}

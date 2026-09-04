import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    CampusModule,
    TypeOrmModule.forFeature([User]),
    ProductModule,
    ProductCategoryModule,
    ProductStoreModule,
    ProductStoreCategoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProtectMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/signup', method: RequestMethod.POST },

        { path: 'auth/check-email', method: RequestMethod.POST },
        { path: 'auth/refresh-token', method: RequestMethod.POST },
        { path: 'auth/verify-otp', method: RequestMethod.POST },
        { path: 'auth/send-otp', method: RequestMethod.POST },
        { path: 'auth/reset-password/:token', method: RequestMethod.PATCH },
        { path: 'auth/create-password/:token', method: RequestMethod.PATCH },
        { path: 'subscription/webhook', method: RequestMethod.POST },
        { path: 'webhook/stripe', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}

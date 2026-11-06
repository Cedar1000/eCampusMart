import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity';
import { OrderExpirySweep } from './order-expiry.sweep';
import { OrderGateway } from './order.gateway';
import { OrderRating } from './entities/order-rating.entity';
import { OrderRatingService } from './order-rating.service';
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderRating, Product, User, ProductStore]),
    NotificationModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderRatingService, OrderExpirySweep, OrderGateway],
  exports: [OrderService],
})
export class OrderModule {}

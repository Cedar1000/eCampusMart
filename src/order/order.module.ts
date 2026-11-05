import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity';
import { OrderExpirySweep } from './order-expiry.sweep';
import { OrderGateway } from './order.gateway';
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product, User, ProductStore])],
  controllers: [OrderController],
  providers: [OrderService, OrderExpirySweep, OrderGateway],
  exports: [OrderService],
})
export class OrderModule {}

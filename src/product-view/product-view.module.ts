import { Module } from '@nestjs/common';
import { ProductViewService } from './product-view.service';
import { ProductViewController } from './product-view.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductView } from './entities/product-view.entity';
import { Product } from 'src/product/entities/product.entity';

import { BullModule } from '@nestjs/bullmq';
import { PRODUCT_QUE } from 'src/product/product.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductView, Product]),
    BullModule.registerQueue({ name: PRODUCT_QUE }),
  ],
  controllers: [ProductViewController],
  providers: [ProductViewService],
  exports: [ProductViewService],
})
export class ProductViewModule {}

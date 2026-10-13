import { Module } from '@nestjs/common';
import { ProductFavouriteService } from './product-favourite.service';
import { ProductFavouriteController } from './product-favourite.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductFavourite } from './entities/product-favourite.entity';
import { Product } from 'src/product/entities/product.entity';
import { IncludeFavouriteProductInterceptor } from './interceptors/include-favourite-product.interceptor';

import { BullModule } from '@nestjs/bullmq';
import { PRODUCT_QUE } from 'src/product/product.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductFavourite, Product]),
    BullModule.registerQueue({ name: PRODUCT_QUE }),
  ],

  controllers: [ProductFavouriteController],

  providers: [ProductFavouriteService, IncludeFavouriteProductInterceptor],
})
export class ProductFavouriteModule {}

import { Module } from '@nestjs/common';
import { ProductFavouriteService } from './product-favourite.service';
import { ProductFavouriteController } from './product-favourite.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductFavourite } from './entities/product-favourite.entity';
import { Product } from 'src/product/entities/product.entity';
import { IncludeFavouriteProductInterceptor } from './interceptors/include-favourite-product.interceptor';

import { BullModule } from '@nestjs/bullmq';
import { PRODUCT_FAVOURITE_QUEUE } from 'src/product/product.constants';
import { ProductFavouriteProcessor } from './processor/product-favourite.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductFavourite, Product]),

    BullModule.registerQueue({
      name: PRODUCT_FAVOURITE_QUEUE,
    }),
  ],

  controllers: [ProductFavouriteController],

  providers: [
    ProductFavouriteService,
    IncludeFavouriteProductInterceptor,
    ProductFavouriteProcessor,
  ],
})
export class ProductFavouriteModule {}

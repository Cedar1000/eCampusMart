import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from 'src/auth/entities/user.entity';
import { Product } from './entities/product.entity';
import { ProductView } from 'src/product-view/entities/product-view.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';

import { IncludeIsLikedInterceptor } from './interceptors/has-liked-product.interceptor';
import { ProductUserDetailsInterceptor } from './interceptors/product-user-details.interceptor';

import { ValidProductStoreGuard } from './guards/valid-product-store.guard';
import { ValidProductCategoryGuard } from './guards/valid-product-category.guard';
import { ProductViewService } from 'src/product-view/product-view.service';

import { PRODUCT_VIEWING_QUEUE } from './product.constants';
import { ProductViewProcessor } from './processor/product-view.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Product,
      ProductView,
      ProductImage,
      ProductStore,
      ProductCategory,
    ]),

    BullModule.registerQueue({
      name: PRODUCT_VIEWING_QUEUE,
    }),
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductUserDetailsInterceptor,
    IncludeIsLikedInterceptor,
    ValidProductCategoryGuard,
    ValidProductStoreGuard,
    ProductViewService,
    ProductViewProcessor,
  ],
})
export class ProductModule {}

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

import { PRODUCT_QUE } from './product.constants';
import { ProductProcessor } from './processor/product.processor';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { HasProductUploadBalanceGuard } from './guards/has-product-upload-balance.guard';
import { ProductFavourite } from 'src/product-favourite/entities/product-favourite.entity';
import { ProductFavouriteService } from 'src/product-favourite/product-favourite.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Product,
      ProductView,
      ProductImage,
      ProductStore,
      ProductCategory,
      Wallet,
      Transaction,
      ProductFavourite,
    ]),

    BullModule.registerQueue({ name: PRODUCT_QUE }),
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductUserDetailsInterceptor,
    IncludeIsLikedInterceptor,
    ValidProductCategoryGuard,
    ValidProductStoreGuard,
    HasProductUploadBalanceGuard,
    ProductViewService,
    ProductFavouriteService,
    ProductProcessor,
  ],
})
export class ProductModule {}

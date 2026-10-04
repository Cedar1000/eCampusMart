import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { User } from 'src/auth/entities/user.entity';
import { ProductUserDetailsInterceptor } from './interceptors/product-user-details.interceptor';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';
import { ValidProductCategoryGuard } from './guards/valid-product-category.guard';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ValidProductStoreGuard } from './guards/valid-product-store.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductImage,
      User,
      ProductCategory,
      ProductStore,
    ]),
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductUserDetailsInterceptor,
    ValidProductCategoryGuard,
    ValidProductStoreGuard,
  ],
})
export class ProductModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStoreService } from './product-store.service';
import { ProductStoreController } from './product-store.controller';
import { ProductStore } from './entities/product-store.entity';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';
import { ValidProductCategoryGuard } from 'src/product/guards/valid-product-category.guard';
import { UniqueProductStoreGuard } from './guards/unique-product-store.guard';
import { Campus } from 'src/campus/entities/campus.entity';
import { Product } from 'src/product/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductStore, ProductCategory, Campus, Product]),
  ],
  controllers: [ProductStoreController],
  providers: [
    ProductStoreService,
    ValidProductCategoryGuard,
    UniqueProductStoreGuard,
  ],
  exports: [ProductStoreService],
})
export class ProductStoreModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductStoreService } from './product-store.service';
import { ProductStoreController } from './product-store.controller';
import { ProductStore } from './entities/product-store.entity';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';
import { ValidProductCategoryGuard } from 'src/product/guards/valid-product-category.guard';
import { UniqueProductStoreGuard } from './guards/unique-product-store.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ProductStore, ProductCategory])],
  controllers: [ProductStoreController],
  providers: [
    ProductStoreService,
    ValidProductCategoryGuard,
    UniqueProductStoreGuard,
  ],
})
export class ProductStoreModule {}

import { Module } from '@nestjs/common';
import { ProductStoreCategoryService } from './product-store-category.service';
import { ProductStoreCategoryController } from './product-store-category.controller';

@Module({
  controllers: [ProductStoreCategoryController],
  providers: [ProductStoreCategoryService],
})
export class ProductStoreCategoryModule {}

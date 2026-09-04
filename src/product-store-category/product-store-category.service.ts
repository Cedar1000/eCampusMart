import { Injectable } from '@nestjs/common';
import { CreateProductStoreCategoryDto } from './dto/create-product-store-category.dto';
import { UpdateProductStoreCategoryDto } from './dto/update-product-store-category.dto';

@Injectable()
export class ProductStoreCategoryService {
  create(createProductStoreCategoryDto: CreateProductStoreCategoryDto) {
    return 'This action adds a new productStoreCategory';
  }

  findAll() {
    return `This action returns all productStoreCategory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} productStoreCategory`;
  }

  update(id: number, updateProductStoreCategoryDto: UpdateProductStoreCategoryDto) {
    return `This action updates a #${id} productStoreCategory`;
  }

  remove(id: number) {
    return `This action removes a #${id} productStoreCategory`;
  }
}

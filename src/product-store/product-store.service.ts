import { Injectable } from '@nestjs/common';
import { CreateProductStoreDto } from './dto/create-product-store.dto';
import { UpdateProductStoreDto } from './dto/update-product-store.dto';

@Injectable()
export class ProductStoreService {
  create(createProductStoreDto: CreateProductStoreDto) {
    return 'This action adds a new productStore';
  }

  findAll() {
    return `This action returns all productStore`;
  }

  findOne(id: number) {
    return `This action returns a #${id} productStore`;
  }

  update(id: number, updateProductStoreDto: UpdateProductStoreDto) {
    return `This action updates a #${id} productStore`;
  }

  remove(id: number) {
    return `This action removes a #${id} productStore`;
  }
}

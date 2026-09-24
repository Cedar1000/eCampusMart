import { Injectable } from '@nestjs/common';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductCategory } from './entities/product-category.entity';
import { Repository } from 'typeorm';

import * as factory from 'utils/handlerFactory';
import IQuery from 'interfaces/query.Interface';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepo: Repository<ProductCategory>,
  ) {}

  async createProductCategory(
    createProductCategoryDto: CreateProductCategoryDto,
  ) {
    return await factory.createOne(
      this.productCategoryRepo,
      createProductCategoryDto,
    );
  }

  async findAllProductCategories(query: Partial<IQuery>) {
    return await factory.getAll(this.productCategoryRepo, query);
  }

  async findProductCategoryById(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.productCategoryRepo, id, query);
  }

  async updateProductCategory(
    id: string,
    updateProductCategoryDto: UpdateProductCategoryDto,
  ) {
    return await factory.updateOne(
      this.productCategoryRepo,
      id,
      updateProductCategoryDto,
    );
  }

  async deleteProductCategory(id: string) {
    return await factory.deleteOne(this.productCategoryRepo, id);
  }
}

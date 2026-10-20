import { ConflictException, Injectable } from '@nestjs/common';
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
    await this.assertNameIsFree(createProductCategoryDto.name);

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
    if (updateProductCategoryDto.name !== undefined) {
      await this.assertNameIsFree(updateProductCategoryDto.name, id);
    }

    return await factory.updateOne(
      this.productCategoryRepo,
      id,
      updateProductCategoryDto,
    );
  }

  async deleteProductCategory(id: string) {
    return await factory.deleteOne(this.productCategoryRepo, id);
  }

  // Names are unique ignoring case and spaces; exceptId lets a category keep its own
  private async assertNameIsFree(name: string, exceptId?: string) {
    const query = this.productCategoryRepo
      .createQueryBuilder('category')
      .where('LOWER(TRIM(category.name)) = LOWER(TRIM(:name))', { name });

    if (exceptId) query.andWhere('category.id <> :exceptId', { exceptId });

    if (await query.getExists()) {
      throw new ConflictException('A category with that name already exists');
    }
  }
}

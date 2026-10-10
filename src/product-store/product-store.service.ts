import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { DataSource, Repository } from 'typeorm';

import { CreateProductStoreDto } from './dto/create-product-store.dto';
import { UpdateProductStoreDto } from './dto/update-product-store.dto';
import { ProductStore } from './entities/product-store.entity';
import { Product } from 'src/product/entities/product.entity';

@Injectable()
export class ProductStoreService {
  constructor(
    @InjectRepository(ProductStore)
    private readonly productStoreRepo: Repository<ProductStore>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createProductStoreDto: CreateProductStoreDto) {
    return await factory.createOne(
      this.productStoreRepo,
      createProductStoreDto,
    );
  }

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.productStoreRepo, query);
  }

  async findOne(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.productStoreRepo, id, query);
  }

  async findByUserId(userId: string): Promise<ProductStore | null> {
    return this.productStoreRepo.findOne({
      where: { userId },
      select: ['id', 'name', 'logo'],
    });
  }

  async update(id: string, updateProductStoreDto: UpdateProductStoreDto) {
    return await factory.updateOne(
      this.productStoreRepo,
      id,
      updateProductStoreDto,
    );
  }

  async remove(id: string) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete all products belonging to the store
      await queryRunner.manager.update(
        Product,
        { storeId: id },
        { storeId: undefined, isStoreProduct: false },
      );

      // Delete the store
      const result = await queryRunner.manager.delete(ProductStore, id);

      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

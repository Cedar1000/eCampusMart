import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';

import { CreateProductStoreDto } from './dto/create-product-store.dto';
import { UpdateProductStoreDto } from './dto/update-product-store.dto';
import { ProductStore } from './entities/product-store.entity';
import { ProductStoreCategory } from 'src/product-store-category/entities/product-store-category.entity';
import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';

@Injectable()
export class ProductStoreService {
  constructor(
    @InjectRepository(ProductStore)
    private readonly productStoreRepo: Repository<ProductStore>,

    private readonly listingCleanupService: ListingCleanupService,
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

  async findMine(userId: string) {
    const store = await this.productStoreRepo.findOne({ where: { userId } });

    if (!store) throw new NotFoundException('You do not have a product store');

    return { status: 'success', message: 'Get One successful!', data: store };
  }

  async update(
    id: string,
    updateProductStoreDto: UpdateProductStoreDto,
    userId: string,
  ) {
    await this.assertOwner(id, userId);

    return await factory.updateOne(
      this.productStoreRepo,
      id,
      updateProductStoreDto,
    );
  }

  // Deleting a store deletes its products, their photos and favourites with it
  async remove(id: string, userId: string) {
    const store = await this.assertOwner(id, userId);

    await this.listingCleanupService.deleteListings(
      'product',
      { storeId: id },
      async (manager) => {
        await manager.delete(ProductStoreCategory, { storeId: id });
        await manager.delete(ProductStore, id);

        return [store.logoKey, store.bannerKey].filter(
          (key): key is string => !!key,
        );
      },
    );

    return { status: 'success', message: 'delete successful!' };
  }

  private async assertOwner(id: string, userId: string) {
    const store = await this.productStoreRepo.findOne({
      where: { id },
      select: ['id', 'userId', 'logoKey', 'bannerKey'],
    });

    if (!store) throw new NotFoundException('No resource with that ID');

    if (store.userId !== userId) {
      throw new ForbiddenException('You can only modify your own store');
    }

    return store;
  }
}

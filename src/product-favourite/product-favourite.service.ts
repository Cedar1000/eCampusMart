import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductFavouriteDto } from './dto/create-product-favourite.dto';

import * as factory from 'utils/handlerFactory';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductFavourite } from './entities/product-favourite.entity';
import { RedisService } from 'src/redis/redis.service';
import IQuery from 'interfaces/query.Interface';
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import { InjectQueue } from '@nestjs/bullmq';

import {
  PRODUCT_FAVOURITE_JOB,
  PRODUCT_FAVOURITE_QUEUE,
} from 'src/product/product.constants';

import { Queue } from 'bullmq';

interface ProductFavJobData {
  userId: string;
  productId: string;
}

@Injectable()
export class ProductFavouriteService {
  constructor(
    @InjectRepository(ProductFavourite)
    private readonly productFavRepo: Repository<ProductFavourite>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly redisService: RedisService,

    @InjectQueue(PRODUCT_FAVOURITE_QUEUE)
    private readonly productFavQueue: Queue<ProductFavJobData>,
  ) {}

  async create(dto: CreateProductFavouriteDto, user: User) {
    const { productId } = dto;

    const check = await this.productFavRepo.findOneBy({
      userId: user.id,
      productId,
    });

    if (check && productId) {
      await this.redisService.sadd(`user:${user.id}:liked-products`, productId);

      return { status: 'success', message: 'create successful!', data: check };
    }

    const data = await factory.createOne(this.productFavRepo, dto);

    const favourite = data.data as ProductFavourite;

    const { productId: favouriteProductId, userId } = favourite;

    if (userId && favouriteProductId) {
      await this.redisService.sadd(
        `user:${userId}:liked-products`,
        favouriteProductId,
      );
    }

    await this.productFavQueue.add(
      PRODUCT_FAVOURITE_JOB,
      { productId, userId: user.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return data;
  }

  async findAll(query: IQuery) {
    return await factory.getAll(this.productFavRepo, query);
  }

  async remove(productId: string, user: User) {
    const result = await this.productFavRepo.delete({
      userId: user.id,
      productId,
    });

    if (!result.affected) {
      throw new NotFoundException('Favourite not found');
    }

    await this.redisService.srem(`user:${user.id}:liked-products`, productId);

    return { status: 'success', message: 'delete successful!' };
  }

  async calculateFavourite(data: { productId: string; userId: string }) {
    const { productId } = data;

    const favoriteCount = await this.productFavRepo.countBy({ productId });

    await this.productRepo.update({ id: productId }, { favoriteCount });
  }
}

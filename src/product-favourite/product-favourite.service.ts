import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductFavouriteDto } from './dto/create-product-favourite.dto';

import * as factory from 'utils/handlerFactory';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductFavourite } from './entities/product-favourite.entity';
import { RedisService } from 'src/redis/redis.service';
import IQuery from 'interfaces/query.Interface';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ProductFavouriteService {
  constructor(
    @InjectRepository(ProductFavourite)
    private readonly productFavRepo: Repository<ProductFavourite>,

    private readonly redisService: RedisService,
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
}

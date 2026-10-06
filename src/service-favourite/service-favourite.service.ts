import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceFavouriteDto } from './dto/create-service-favourite.dto';

import * as factory from 'utils/handlerFactory';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceFavourite } from './entities/service-favourite.entity';
import { RedisService } from 'src/redis/redis.service';
import IQuery from 'interfaces/query.Interface';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ServiceFavouriteService {
  constructor(
    @InjectRepository(ServiceFavourite)
    private readonly serviceFavRepo: Repository<ServiceFavourite>,

    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateServiceFavouriteDto, user: User) {
    const { serviceId } = dto;

    const check = await this.serviceFavRepo.findOneBy({
      userId: user.id,
      serviceId,
    });

    if (check && serviceId) {
      await this.redisService.sadd(`user:${user.id}:liked-services`, serviceId);

      return { status: 'success', message: 'create successful!', data: check };
    }

    const data = await factory.createOne(this.serviceFavRepo, dto);

    const favourite = data.data as ServiceFavourite;

    const { serviceId: favouriteServiceId, userId } = favourite;

    if (userId && favouriteServiceId) {
      await this.redisService.sadd(
        `user:${userId}:liked-services`,
        favouriteServiceId,
      );
    }

    return data;
  }

  async findAll(query: IQuery) {
    return await factory.getAll(this.serviceFavRepo, query);
  }

  async remove(serviceId: string, user: User) {
    const result = await this.serviceFavRepo.delete({
      userId: user.id,
      serviceId,
    });

    if (!result.affected) {
      throw new NotFoundException('Favourite not found');
    }

    await this.redisService.srem(`user:${user.id}:liked-services`, serviceId);

    return { status: 'success', message: 'delete successful!' };
  }
}

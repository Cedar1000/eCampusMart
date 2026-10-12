import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceFavouriteDto } from './dto/create-service-favourite.dto';

import * as factory from 'utils/handlerFactory';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceFavourite } from './entities/service-favourite.entity';
import { RedisService } from 'src/redis/redis.service';
import IQuery from 'interfaces/query.Interface';
import { User } from 'src/auth/entities/user.entity';
import { Service } from 'src/service/entities/service.entity';
import { InjectQueue } from '@nestjs/bullmq';
import {
  SERVICE_FAVOURITE_JOB,
  SERVICE_QUE,
} from 'src/service/service.constant';
import { Queue } from 'bullmq';

interface ServiceFavJobData {
  userId: string;
  serviceId: string;
}

@Injectable()
export class ServiceFavouriteService {
  constructor(
    @InjectRepository(ServiceFavourite)
    private readonly serviceFavRepo: Repository<ServiceFavourite>,

    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,

    private readonly redisService: RedisService,

    @InjectQueue(SERVICE_QUE)
    private readonly serviceQueue: Queue<ServiceFavJobData>,
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

    await this.serviceQueue.add(
      SERVICE_FAVOURITE_JOB,
      { serviceId, userId: user.id },
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
    return await factory.getAll(this.serviceFavRepo, query);
  }

  async remove(serviceId: string, user: User) {
    const result = await this.serviceFavRepo.delete({
      userId: user.id,
      serviceId,
    });

    if (!result.affected) throw new NotFoundException('Favourite not found');

    await this.redisService.srem(`user:${user.id}:liked-services`, serviceId);

    await this.serviceQueue.add(
      SERVICE_FAVOURITE_JOB,
      { serviceId, userId: user.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return { status: 'success', message: 'delete successful!' };
  }

  async calculateFavourite(data: { serviceId: string; userId: string }) {
    const { serviceId } = data;

    const favoriteCount = await this.serviceFavRepo.countBy({ serviceId });

    await this.serviceRepo.update({ id: serviceId }, { favoriteCount });
  }
}

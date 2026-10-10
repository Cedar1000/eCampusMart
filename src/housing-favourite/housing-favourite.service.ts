import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import * as factory from 'utils/handlerFactory';
import IQuery from 'interfaces/query.Interface';

import { User } from 'src/auth/entities/user.entity';
import { RedisService } from 'src/redis/redis.service';
import { Housing } from 'src/housing/entities/housing.entity';
import {
  HOUSING_FAVOURITE_JOB,
  HOUSING_FAVOURITE_QUEUE,
} from 'src/housing-favourite/housing.constants';

import { CreateHousingFavouriteDto } from './dto/create-housing-favourite.dto';
import { HousingFavourite } from './entities/housing-favourite.entity';

interface HousingFavJobData {
  userId: string;
  housingId: string;
}

@Injectable()
export class HousingFavouriteService {
  constructor(
    @InjectRepository(HousingFavourite)
    private readonly housingFavRepo: Repository<HousingFavourite>,

    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,

    private readonly redisService: RedisService,

    @InjectQueue(HOUSING_FAVOURITE_QUEUE)
    private readonly housingFavQueue: Queue<HousingFavJobData>,
  ) {}

  async create(dto: CreateHousingFavouriteDto, user: User) {
    const { housingId } = dto;

    const check = await this.housingFavRepo.findOneBy({
      userId: user.id,
      housingId,
    });

    if (check && housingId) {
      await this.redisService.sadd(`user:${user.id}:liked-housing`, housingId);

      return { status: 'success', message: 'create successful!', data: check };
    }

    const data = await factory.createOne(this.housingFavRepo, {
      ...dto,
      userId: user.id,
    });

    const favourite = data.data as HousingFavourite;

    const { housingId: favouriteHousingId, userId } = favourite;

    if (userId && favouriteHousingId) {
      await this.redisService.sadd(
        `user:${userId}:liked-housing`,
        favouriteHousingId,
      );
    }

    await this.housingFavQueue.add(
      HOUSING_FAVOURITE_JOB,
      { housingId, userId: user.id },
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
    return await factory.getAll(this.housingFavRepo, query);
  }

  async remove(housingId: string, user: User) {
    const result = await this.housingFavRepo.delete({
      userId: user.id,
      housingId,
    });

    if (!result.affected) {
      throw new NotFoundException('Favourite not found');
    }

    await this.redisService.srem(`user:${user.id}:liked-housing`, housingId);

    // Keep the count in sync on unlike too
    await this.housingFavQueue.add(
      HOUSING_FAVOURITE_JOB,
      { housingId, userId: user.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return { status: 'success', message: 'delete successful!' };
  }

  async calculateFavourite(data: { housingId: string; userId: string }) {
    const { housingId } = data;

    const favoriteCount = await this.housingFavRepo.countBy({ housingId });

    await this.housingRepo.update({ id: housingId }, { favoriteCount });
  }
}

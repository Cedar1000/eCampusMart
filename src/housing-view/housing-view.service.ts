import { Injectable, NotFoundException } from '@nestjs/common';

import { HousingView } from './entities/housing-view.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import * as factory from 'utils/handlerFactory';
import { Housing } from 'src/housing/entities/housing.entity';
import { HOUSING_QUE, HOUSING_VIEW_JOB } from 'src/housing/housing.constants';

interface HousingViewJobData {
  housingId: string;
  userId: string;
}

@Injectable()
export class HousingViewService {
  constructor(
    @InjectRepository(HousingView)
    private readonly housingViewRepo: Repository<HousingView>,

    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,

    @InjectQueue(HOUSING_QUE)
    private readonly housingQueue: Queue<HousingViewJobData>,
  ) {}

  // The processor saves the view and recounts the housing's viewCount
  async recordView(housingId: string, userId: string) {
    const housing = await this.housingRepo.findOne({
      where: { id: housingId },
      select: ['id', 'userId'],
    });

    if (!housing) {
      throw new NotFoundException('Housing not found');
    }

    // Owners looking at their own listing don't count as views
    if (housing.userId !== userId) {
      await this.housingQueue.add(
        HOUSING_VIEW_JOB,
        { housingId, userId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    return { status: 'success', message: 'View recorded' };
  }

  async create(data: HousingViewJobData) {
    await factory.createOne(this.housingViewRepo, data);

    return await this.housingViewRepo.count({
      where: { housingId: data.housingId },
    });
  }
}

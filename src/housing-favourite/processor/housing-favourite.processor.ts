import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import {
  HOUSING_FAVOURITE_JOB,
  HOUSING_FAVOURITE_QUEUE,
} from '../../housing-favourite/housing.constants';

import { HousingFavouriteService } from '../housing-favourite.service';

interface HousingFavouriteJobData {
  housingId: string;
  userId: string;
}

@Injectable()
@Processor(HOUSING_FAVOURITE_QUEUE)
export class HousingFavouriteProcessor extends WorkerHost {
  private readonly logger = new Logger(HousingFavouriteProcessor.name);

  constructor(private readonly housingFavService: HousingFavouriteService) {
    super();
  }

  async process(job: Job<HousingFavouriteJobData>) {
    if (job.name !== HOUSING_FAVOURITE_JOB) {
      this.logger.warn(`Received unsupported job ${job.name}.`);
      return;
    }

    await this.housingFavService.calculateFavourite(job.data);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<HousingFavouriteJobData>) {
    this.logger.log(
      `Completed calculating favourite for housing ${job.data.housingId}.`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<HousingFavouriteJobData> | undefined, error: Error) {
    const housingId = job?.data?.housingId || 'unknown';

    this.logger.error(
      `Failed calculating favourite for housing ${housingId}: ${error.message}`,
      error.stack,
    );
  }
}

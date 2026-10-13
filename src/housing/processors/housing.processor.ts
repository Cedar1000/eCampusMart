import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import {
  HOUSING_FAVOURITE_JOB,
  HOUSING_QUE,
  HOUSING_VIEW_JOB,
} from '../housing.constants';

import { HousingService } from '../housing.service';

import { HousingFavouriteService } from 'src/housing-favourite/housing-favourite.service';

interface HousingJobData {
  housingId: string;
  userId: string;
}

@Injectable()
@Processor(HOUSING_QUE)
export class HousingProcessor extends WorkerHost {
  private readonly logger = new Logger(HousingProcessor.name);

  constructor(
    private readonly housingService: HousingService,
    private readonly housingFavService: HousingFavouriteService,
  ) {
    super();
  }

  async process(job: Job<HousingJobData>) {
    switch (job.name) {
      case HOUSING_VIEW_JOB:
        await this.housingService.creatAndCalculateViews(job.data);
        break;

      case HOUSING_FAVOURITE_JOB:
        await this.housingFavService.calculateFavourite(job.data);
        break;

      default:
        this.logger.warn(`Received unsupported job ${job.name}.`);
        break;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<HousingJobData>) {
    this.logger.log(`Completed ${job.name} for housing ${job.data.housingId}.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<HousingJobData> | undefined, error: Error) {
    const housingId = job?.data?.housingId || 'unknown';

    this.logger.error(
      `Failed ${job?.name} for housing ${housingId}: ${error.message}`,
      error.stack,
    );
  }
}

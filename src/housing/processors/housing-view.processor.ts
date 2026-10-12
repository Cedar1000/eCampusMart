import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { HOUSING_VIEW_JOB, HOUSING_VIEW_QUE } from '../housing.constants';

import { HousingService } from '../housing.service';

interface HousingViewJobData {
  housingId: string;
  userId: string;
}

@Injectable()
@Processor(HOUSING_VIEW_QUE)
export class HousingViewProcessor extends WorkerHost {
  private readonly logger = new Logger(HousingViewProcessor.name);

  constructor(private readonly housingService: HousingService) {
    super();
  }

  async process(job: Job<HousingViewJobData>) {
    console.log('processing housing view....');
    if (job.name !== HOUSING_VIEW_JOB) {
      this.logger.warn(`Received unsupported job ${job.name}.`);
      return;
    }

    await this.housingService.creatAndCalculateViews(job.data);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<HousingViewJobData>) {
    this.logger.log(
      `Completed calculating view for housing ${job.data.userId}.`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<HousingViewJobData> | undefined, error: Error) {
    const housingId = job?.data?.housingId || 'unknown';

    this.logger.error(
      `Failed calculating view for housing ${housingId}: ${error.message}`,
      error.stack,
    );
  }
}

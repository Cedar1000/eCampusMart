import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { ServiceService } from '../service.service';

import {
  SERVICE_FAVOURITE_JOB,
  SERVICE_QUE,
  SERVICE_VIEW_JOB,
} from '../service.constant';

import { ServiceFavouriteService } from 'src/service-favourite/service-favourite.service';

interface ServiceViewJobData {
  serviceId: string;
  userId: string;
}

@Injectable()
@Processor(SERVICE_QUE)
export class ServiceProcessor extends WorkerHost {
  private readonly logger = new Logger(ServiceProcessor.name);

  constructor(
    private readonly serviceService: ServiceService,
    private readonly serviceFavService: ServiceFavouriteService,
  ) {
    super();
  }

  async process(job: Job<ServiceViewJobData>) {
    console.log('processing service view....');

    switch (job.name) {
      case SERVICE_VIEW_JOB:
        await this.serviceService.calculateViews(job.data);
        break;

      case SERVICE_FAVOURITE_JOB:
        await this.serviceFavService.calculateFavourite(job.data);
        break;

      default:
        this.logger.warn(`Received unsupported job ${job.name}.`);
        break;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ServiceViewJobData>) {
    this.logger.log(
      `Completed calculating view for service ${job.data.userId}.`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ServiceViewJobData> | undefined, error: Error) {
    const serviceId = job?.data?.serviceId || 'unknown';

    this.logger.error(
      `Failed calculating view for service ${serviceId}: ${error.message}`,
      error.stack,
    );
  }
}

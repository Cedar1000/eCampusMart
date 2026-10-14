import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { ServiceService } from '../service.service';

import {
  SERVICE_FAVOURITE_JOB,
  SERVICE_QUE,
  SERVICE_STORE_COUNT_JOB,
  SERVICE_VIEW_JOB,
} from '../service.constant';

import { ServiceFavouriteService } from 'src/service-favourite/service-favourite.service';

interface ServiceViewJobData {
  serviceId: string;
  userId: string;
}

interface ServiceStoreCountJobData {
  storeId: string;
}

type ServiceJobData = ServiceViewJobData | ServiceStoreCountJobData;

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

  async process(job: Job<ServiceJobData>) {
    switch (job.name) {
      case SERVICE_VIEW_JOB:
        await this.serviceService.calculateViews(
          job.data as ServiceViewJobData,
        );
        break;

      case SERVICE_FAVOURITE_JOB:
        await this.serviceFavService.calculateFavourite(
          job.data as ServiceViewJobData,
        );
        break;

      case SERVICE_STORE_COUNT_JOB:
        await this.serviceService.calculateStoreServicesCount(
          job.data as ServiceStoreCountJobData,
        );
        break;

      default:
        this.logger.warn(`Received unsupported job ${job.name}.`);
        break;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ServiceJobData>) {
    this.logger.log(`Completed ${job.name} ${JSON.stringify(job.data)}.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ServiceJobData> | undefined, error: Error) {
    this.logger.error(
      `Failed ${job?.name ?? 'job'} ${JSON.stringify(job?.data)}: ${error.message}`,
      error.stack,
    );
  }
}

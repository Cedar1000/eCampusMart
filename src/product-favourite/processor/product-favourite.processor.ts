import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import {
  PRODUCT_FAVOURITE_JOB,
  PRODUCT_FAVOURITE_QUEUE,
} from '../../product/product.constants';

import { ProductFavouriteService } from '../product-favourite.service';

interface ProductFavouriteJobData {
  productId: string;
  userId: string;
}

@Injectable()
@Processor(PRODUCT_FAVOURITE_QUEUE)
export class ProductFavouriteProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductFavouriteProcessor.name);

  constructor(private readonly productFavService: ProductFavouriteService) {
    super();
  }

  async process(job: Job<ProductFavouriteJobData>) {
    console.log('processing product favourite....');

    if (job.name !== PRODUCT_FAVOURITE_JOB) {
      this.logger.warn(`Received unsupported job ${job.name}.`);
      return;
    }

    await this.productFavService.calculateFavourite(job.data);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProductFavouriteJobData>) {
    this.logger.log(
      `Completed calculating favourite for product ${job.data.userId}.`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProductFavouriteJobData> | undefined, error: Error) {
    const productId = job?.data?.productId || 'unknown';

    this.logger.error(
      `Failed calculating favourite for product ${productId}: ${error.message}`,
      error.stack,
    );
  }
}

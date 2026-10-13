import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import {
  PRODUCT_FAVOURITE_JOB,
  PRODUCT_QUE,
  PRODUCT_VIEWING_JOB,
} from '../product.constants';

import { ProductService } from '../product.service';

import { ProductFavouriteService } from 'src/product-favourite/product-favourite.service';

interface ProductJobData {
  productId: string;
  userId: string;
}

@Injectable()
@Processor(PRODUCT_QUE)
export class ProductProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductProcessor.name);

  constructor(
    private readonly productService: ProductService,
    private readonly productFavService: ProductFavouriteService,
  ) {
    super();
  }

  async process(job: Job<ProductJobData>) {
    switch (job.name) {
      case PRODUCT_VIEWING_JOB:
        await this.productService.creatAndCalculateViews(job.data);
        break;

      case PRODUCT_FAVOURITE_JOB:
        await this.productFavService.calculateFavourite(job.data);
        break;

      default:
        this.logger.warn(`Received unsupported job ${job.name}.`);
        break;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProductJobData>) {
    this.logger.log(`Completed ${job.name} for product ${job.data.productId}.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProductJobData> | undefined, error: Error) {
    const productId = job?.data?.productId || 'unknown';

    this.logger.error(
      `Failed ${job?.name} for product ${productId}: ${error.message}`,
      error.stack,
    );
  }
}

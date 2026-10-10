import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import {
  PRODUCT_VIEWING_JOB,
  PRODUCT_VIEWING_QUEUE,
} from '../product.constants';

import { ProductService } from '../product.service';

interface ProductViewJobData {
  productId: string;
  userId: string;
}

@Injectable()
@Processor(PRODUCT_VIEWING_QUEUE)
export class ProductViewProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductViewProcessor.name);

  constructor(private readonly productService: ProductService) {
    super();
  }

  async process(job: Job<ProductViewJobData>) {
    console.log('processing product view....');
    if (job.name !== PRODUCT_VIEWING_JOB) {
      this.logger.warn(`Received unsupported job ${job.name}.`);
      return;
    }

    await this.productService.creatAndCalculateViews(job.data);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProductViewJobData>) {
    this.logger.log(
      `Completed calculating view for product ${job.data.userId}.`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProductViewJobData> | undefined, error: Error) {
    const productId = job?.data?.productId || 'unknown';

    this.logger.error(
      `Failed calculating view for product ${productId}: ${error.message}`,
      error.stack,
    );
  }
}

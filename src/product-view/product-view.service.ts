import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductView } from './entities/product-view.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import * as factory from 'utils/handlerFactory';
import { Product } from 'src/product/entities/product.entity';
import {
  PRODUCT_QUE,
  PRODUCT_VIEWING_JOB,
} from 'src/product/product.constants';

interface ProductViewJobData {
  productId: string;
  userId: string;
}

@Injectable()
export class ProductViewService {
  constructor(
    @InjectRepository(ProductView)
    private readonly productViewRepo: Repository<ProductView>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectQueue(PRODUCT_QUE)
    private readonly productQueue: Queue<ProductViewJobData>,
  ) {}

  // The processor saves the view and recounts the product's viewCount
  async recordView(productId: string, userId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      select: ['id', 'userId'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Owners looking at their own listing don't count as views
    if (product.userId !== userId) {
      await this.productQueue.add(
        PRODUCT_VIEWING_JOB,
        { productId, userId },
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

  async create(data: ProductViewJobData) {
    await factory.createOne(this.productViewRepo, data);

    return await this.productViewRepo.count({
      where: { productId: data.productId },
    });
  }
}

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';

// Only an active product can be ordered. Guards run before validation, so the id
// is checked here too
@Injectable()
export class ActiveProductGuard implements CanActivate {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { productId } = (request.body ?? {}) as { productId?: unknown };

    if (typeof productId !== 'string' || !isUUID(productId)) {
      throw new BadRequestException('productId must be a UUID');
    }

    const product = await this.productRepo.findOne({
      where: { id: productId },
      select: ['id', 'status'],
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('This product is no longer available');
    }

    return true;
  }
}

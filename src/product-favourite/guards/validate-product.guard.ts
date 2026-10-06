import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';

@Injectable()
export class ValidProductGuard implements CanActivate {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const { productId } = request.body;

    const product = await this.productRepo.findOne({
      where: { id: String(productId) },
      select: ['id'],
    });

    if (!product) {
      throw new NotFoundException('Product category not found');
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { Repository } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { Product } from '../entities/product.entity';

@Injectable()
export class ValidProductOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();

    const request = http.getRequest<
      Request<{ id: string }> & { user?: User }
    >();

    const response = http.getResponse<Response & { locals: { user?: User } }>();

    // Wherever your auth middleware/guard stores the user
    const user = request.user ?? response.locals.user;

    if (!user) throw new UnauthorizedException('You must be logged in');

    const productId = request.params.id;

    if (!productId) throw new BadRequestException('Product id is required');

    const product = await this.productRepo.findOne({
      where: { id: productId },
      select: { id: true, userId: true }, // <- adjust the owner column name
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.userId !== user.id) {
      throw new ForbiddenException('You can only modify your own products');
    }

    return true;
  }
}

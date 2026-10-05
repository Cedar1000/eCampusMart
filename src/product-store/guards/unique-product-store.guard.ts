import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductStore } from '../entities/product-store.entity';

@Injectable()
export class UniqueProductStoreGuard implements CanActivate {
  constructor(
    @InjectRepository(ProductStore)
    private readonly productStoreRepository: Repository<ProductStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUserId = request.res?.locals?.user?.id;

    if (!currentUserId) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    const existingStore = await this.productStoreRepository.findOne({
      where: { userId: currentUserId as string },
      select: ['id'],
    });

    if (existingStore) {
      throw new ConflictException('You already have a product store');
    }

    return true;
  }
}

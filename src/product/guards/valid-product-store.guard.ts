import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductStore } from 'src/product-store/entities/product-store.entity';

@Injectable()
export class ValidProductStoreGuard implements CanActivate {
  constructor(
    @InjectRepository(ProductStore)
    private readonly productStoreRepository: Repository<ProductStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const storeId = request.body ? request.body.storeId : null;

    if (!storeId) {
      throw new BadRequestException('No Store ID was passed in');
    }

    const productStore = await this.productStoreRepository.findOne({
      where: { id: String(storeId) },
      select: ['id', 'userId', 'categoryId'],
    });

    if (!productStore) throw new NotFoundException('Product store not found');

    const currentUserId = request.res?.locals?.user?.id;

    if (productStore.userId !== currentUserId) {
      throw new ForbiddenException(
        'You can only create products in your own store',
      );
    }

    if (!productStore.categoryId) {
      throw new BadRequestException('Product store has no category');
    }

    request.body.categoryId = productStore.categoryId;

    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

@Injectable()
export class ValidServiceCategoryGuard implements CanActivate {
  constructor(
    @InjectRepository(ServiceCategory)
    private readonly serviceCategoryRepository: Repository<ServiceCategory>,

    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { categoryId, storeId } = request.body;

    if (!categoryId) return true;

    const serviceCategory = await this.serviceCategoryRepository.findOne({
      where: { id: String(categoryId) },
    });

    if (!serviceCategory) {
      throw new NotFoundException('Service category not found');
    }

    const store = await this.serviceStoreRepo.findOneBy({ id: storeId });

    request.body.categoryId = serviceCategory.id;

    const currentUserId = request.res?.locals?.user?.id;

    if (store?.ownerId !== currentUserId) {
      throw new ForbiddenException(
        'You can only create service in your own store',
      );
    }

    return true;
  }
}

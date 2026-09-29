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
import { CreateServiceDto } from '../dto/create-service.dto';

@Injectable()
export class ValidServiceCategoryGuard implements CanActivate {
  constructor(
    @InjectRepository(ServiceCategory)
    private readonly serviceCategoryRepository: Repository<ServiceCategory>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { categoryId, storeId } = request.body;

    if (!categoryId) return true;

    const serviceCategory = await this.serviceCategoryRepository.findOne({
      where: { id: String(categoryId) },
      relations: { store: true },
    });

    if (!serviceCategory) {
      throw new NotFoundException('Service category not found');
    }

    request.body.categoryId = serviceCategory.id;

    if (storeId && serviceCategory.store?.id !== String(storeId)) {
      throw new ForbiddenException(
        'Service category does not belong to the selected store',
      );
    }

    const currentUserId = request.res?.locals?.user?.id;

    if (serviceCategory.store?.ownerId !== currentUserId) {
      throw new ForbiddenException(
        'You can only use categories from your own store',
      );
    }

    return true;
  }
}

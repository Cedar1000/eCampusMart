import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

@Injectable()
export class ValidServiceStoreGuard implements CanActivate {
  constructor(
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepository: Repository<ServiceStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { storeId } = request.body;

    if (!storeId) return true;

    const serviceStore = await this.serviceStoreRepository.findOne({
      where: { id: String(storeId) },
      select: ['id', 'ownerId', 'categoryId'],
    });

    if (!serviceStore) {
      throw new NotFoundException('Service store not found');
    }

    const currentUserId = request.res?.locals?.user?.id;

    if (serviceStore.ownerId !== currentUserId) {
      throw new ForbiddenException(
        'You can only create a service in your own store',
      );
    }

    request.body.categoryId = serviceStore.categoryId;

    return true;
  }
}

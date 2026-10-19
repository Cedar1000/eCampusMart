import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';

// Allows the participantId param only if it is the current user or one of their stores
@Injectable()
export class ValidParticipantGuard implements CanActivate {
  constructor(
    @InjectRepository(ProductStore)
    private readonly productStoreRepository: Repository<ProductStore>,
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepository: Repository<ServiceStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const participantId = String(request.params.participantId);
    const { user } = (request.res?.locals ?? {}) as { user?: User };
    const currentUserId = user?.id;

    if (!currentUserId) throw new ForbiddenException();

    if (participantId === currentUserId) return true;

    const [productStore, serviceStore] = await Promise.all([
      this.productStoreRepository.exists({
        where: { id: participantId, userId: currentUserId },
      }),
      this.serviceStoreRepository.exists({
        where: { id: participantId, ownerId: currentUserId },
      }),
    ]);

    if (!productStore && !serviceStore) {
      throw new ForbiddenException(
        'You can only view conversations for yourself or your own stores',
      );
    }

    return true;
  }
}

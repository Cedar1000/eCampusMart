import {
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceStore } from '../entities/service-store.entity';

@Injectable()
export class UniqueServiceStoreGuard implements CanActivate {
  constructor(
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepository: Repository<ServiceStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUserId = request.res?.locals?.user?.id;

    if (!currentUserId) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    const existingStore = await this.serviceStoreRepository.findOne({
      where: { ownerId: currentUserId },
      select: ['id'],
    });

    if (existingStore) {
      throw new ConflictException('You already have a service store');
    }

    return true;
  }
}

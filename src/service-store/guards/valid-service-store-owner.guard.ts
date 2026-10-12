import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';
import { User } from 'src/auth/entities/user.entity';
import { Repository } from 'typeorm';
import { ServiceStore } from '../entities/service-store.entity';

@Injectable()
export class ValidServiceStoreOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();

    const request = http.getRequest<
      Request<{ id: string }> & { user?: User }
    >();
    const response = http.getResponse<Response & { locals: { user?: User } }>();

    const user = request.user ?? response.locals.user;

    if (!user) throw new UnauthorizedException('You must be logged in');

    const storeId = request.params.id;

    if (!storeId) throw new BadRequestException('Service store id is required');

    const serviceStore = await this.serviceStoreRepo.findOne({
      where: { id: storeId },
      select: ['id', 'ownerId'],
    });

    if (!serviceStore) throw new NotFoundException('Service store not found');

    if (serviceStore.ownerId !== user.id) {
      throw new ForbiddenException(
        'You can only modify your own service store',
      );
    }

    return true;
  }
}

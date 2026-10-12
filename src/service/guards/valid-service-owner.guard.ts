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
import { Service } from '../entities/service.entity';

@Injectable()
export class ValidServiceOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();

    const request = http.getRequest<
      Request<{ id: string }> & { user?: User }
    >();
    const response = http.getResponse<Response & { locals: { user?: User } }>();

    const user = request.user ?? response.locals.user;

    if (!user) throw new UnauthorizedException('You must be logged in');

    const serviceId = request.params.id;

    if (!serviceId) throw new BadRequestException('Service id is required');

    const service = await this.serviceRepo.findOne({
      where: { id: serviceId },
      relations: { store: true },
      select: {
        id: true,
        store: {
          id: true,
          ownerId: true,
        },
      },
    });

    if (!service) throw new NotFoundException('Service not found');

    if (!service.store || service.store.ownerId !== user.id) {
      throw new ForbiddenException(
        'You can only modify services in your own store',
      );
    }

    return true;
  }
}

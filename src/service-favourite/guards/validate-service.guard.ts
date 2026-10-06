import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Service } from 'src/service/entities/service.entity';

@Injectable()
export class ValidServiceGuard implements CanActivate {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const { serviceId } = request.body;

    const service = await this.serviceRepo.findOne({
      where: { id: String(serviceId) },
      select: ['id'],
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return true;
  }
}

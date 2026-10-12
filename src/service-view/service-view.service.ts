import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import * as factory from 'utils/handlerFactory';
import { ServiceView } from './entities/service-view.entity';
import { CreateServiceViewDto } from './dto/create-service-view.dto';

@Injectable()
export class ServiceViewService {
  constructor(
    @InjectRepository(ServiceView)
    private readonly productViewRepo: Repository<ServiceView>,
  ) {}

  async create(dto: CreateServiceViewDto) {
    const data = await factory.createOne(this.productViewRepo, dto);

    const view = data.data as ServiceView;

    const { serviceId } = view;

    const viewCount = await this.productViewRepo.count({
      where: { serviceId },
    });

    return viewCount;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import * as factory from 'utils/handlerFactory';
import { ServiceView } from './entities/service-view.entity';
import { Service } from 'src/service/entities/service.entity';
import { SERVICE_QUE, SERVICE_VIEW_JOB } from 'src/service/service.constant';

interface ServiceViewJobData {
  serviceId: string;
  userId: string;
}

@Injectable()
export class ServiceViewService {
  constructor(
    @InjectRepository(ServiceView)
    private readonly serviceViewRepo: Repository<ServiceView>,

    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,

    @InjectQueue(SERVICE_QUE)
    private readonly serviceQueue: Queue<ServiceViewJobData>,
  ) {}

  // The processor saves the view and recounts the service's viewCount
  async recordView(serviceId: string, userId: string) {
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId },
      select: ['id', 'ownerId'],
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Owners looking at their own listing don't count as views
    if (service.ownerId !== userId) {
      await this.serviceQueue.add(
        SERVICE_VIEW_JOB,
        { serviceId, userId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    return { status: 'success', message: 'View recorded' };
  }

  async create(data: ServiceViewJobData) {
    await factory.createOne(this.serviceViewRepo, data);

    return await this.serviceViewRepo.count({
      where: { serviceId: data.serviceId },
    });
  }
}

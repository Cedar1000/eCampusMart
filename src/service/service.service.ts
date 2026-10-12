import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';
import { ServiceImage } from './entities/service-image.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SERVICE_QUE, SERVICE_VIEW_JOB } from './service.constant';
import { ServiceViewService } from 'src/service-view/service-view.service';

interface ServiceViewJobData {
  userId: string;
  serviceId: string;
}

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,

    @InjectRepository(ServiceImage)
    private readonly serviceImageRepo: Repository<ServiceImage>,

    @InjectQueue(SERVICE_QUE)
    private readonly serviceQueue: Queue<ServiceViewJobData>,

    private readonly serviceViewService: ServiceViewService,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    const { images, ...rest } = createServiceDto;

    const data = await factory.createOne(this.serviceRepo, rest);

    const service = data.data as Service;

    if (images) {
      await this.createProductImage(images, service.id);
    }

    return data;
  }

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.serviceRepo, query);
  }

  async findOne(id: string, query: IQuery, userId: string) {
    const data = await factory.getOne(this.serviceRepo, id, query);

    const service = data.data as Service;

    if (service.ownerId !== userId) {
      await this.serviceQueue.add(
        SERVICE_VIEW_JOB,
        { serviceId: service.id, userId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    return data;
  }

  async update(id: string, updateServiceDto: UpdateServiceDto) {
    return await factory.updateOne(this.serviceRepo, id, updateServiceDto);
  }

  async remove(id: string) {
    return await factory.deleteOne(this.serviceRepo, id);
  }

  async createProductImage(images: ServiceImage[], serviceId: string) {
    const serviceImages = images.map((image, index: number) => {
      const serviceImage = new ServiceImage();
      serviceImage.serviceId = serviceId;
      serviceImage.url = image.url;
      serviceImage.key = image.key;

      serviceImage.isCoverImage = index === 0 ? true : false;

      return serviceImage;
    });

    return await this.serviceImageRepo.save(serviceImages);
  }

  async calculateViews(data: { serviceId: string; userId: string }) {
    console.log({ data });

    const viewCount = await this.serviceViewService.create(data);

    const { serviceId } = data;

    await this.serviceRepo.update({ id: serviceId }, { viewCount });
  }
}

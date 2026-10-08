import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';
import { ServiceImage } from './entities/service-image.entity';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,

    @InjectRepository(ServiceImage)
    private readonly serviceImageRepo: Repository<ServiceImage>,
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

  async findOne(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.serviceRepo, id, query);
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
}

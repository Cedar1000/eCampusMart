import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';
import { ServiceImage } from './entities/service-image.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SERVICE_QUE,
  SERVICE_STORE_COUNT_JOB,
  SERVICE_VIEW_JOB,
} from './service.constant';
import { ServiceViewService } from 'src/service-view/service-view.service';
import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';

interface ServiceViewJobData {
  userId: string;
  serviceId: string;
}

interface ServiceStoreCountJobData {
  storeId: string;
}

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,

    @InjectRepository(ServiceImage)
    private readonly serviceImageRepo: Repository<ServiceImage>,

    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,

    @InjectQueue(SERVICE_QUE)
    private readonly serviceQueue: Queue<
      ServiceViewJobData | ServiceStoreCountJobData
    >,

    private readonly serviceViewService: ServiceViewService,

    private readonly listingCleanupService: ListingCleanupService,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    const { images, ...rest } = createServiceDto;
    const serviceStore = await this.serviceStoreRepo.findOne({
      where: { id: rest.storeId },
      select: ['id', 'hasActiveSubscription'],
    });

    if (!serviceStore) throw new NotFoundException('Service store not found');

    const data = await factory.createOne(this.serviceRepo, {
      ...rest,
      isActive: serviceStore.hasActiveSubscription,
    });

    const service = data.data as Service;

    if (images) {
      await this.createProductImage(images, service.id);
    }

    await this.queueStoreCount(serviceStore.id);

    return data;
  }

  async findAll(query: Partial<IQuery>) {
    console.log({ query });
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
    const { images, ...serviceData } = updateServiceDto;

    const data = await factory.updateOne(this.serviceRepo, id, serviceData);

    if (images?.length) {
      const previous = await this.serviceImageRepo.find({
        where: { serviceId: id },
        select: ['key'],
      });

      await this.serviceImageRepo.delete({ serviceId: id });
      await this.createProductImage(images, id);
      await this.listingCleanupService.deleteReplacedImages(
        previous.map(({ key }) => key),
        images,
      );
    }

    return data;
  }

  async remove(id: string) {
    const service = await this.serviceRepo.findOne({
      where: { id },
      select: ['id', 'storeId'],
    });

    if (!service) throw new NotFoundException('No resource with that ID');

    await this.listingCleanupService.deleteListings('service', { id });

    if (service.storeId) await this.queueStoreCount(service.storeId);

    return { status: 'success', message: 'delete successful!' };
  }

  // Recounts instead of incrementing, so retries or out-of-order jobs can't skew it
  async calculateStoreServicesCount({ storeId }: ServiceStoreCountJobData) {
    const servicesCount = await this.serviceRepo.countBy({ storeId });

    await this.serviceStoreRepo.update({ id: storeId }, { servicesCount });
  }

  private async queueStoreCount(storeId: string) {
    await this.serviceQueue.add(
      SERVICE_STORE_COUNT_JOB,
      { storeId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
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
    const viewCount = await this.serviceViewService.create(data);

    const { serviceId } = data;

    await this.serviceRepo.update({ id: serviceId }, { viewCount });
  }
}

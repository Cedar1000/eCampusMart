import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateServiceStoreDto } from './dto/create-service-store.dto';
import { UpdateServiceStoreDto } from './dto/update-service-store.dto';
import { ServiceStore } from './entities/service-store.entity';

@Injectable()
export class ServiceStoreService {
  constructor(
    @InjectRepository(ServiceStore)
    private readonly serviceStoreRepo: Repository<ServiceStore>,
  ) {}

  async createServiceStore(createServiceStoreDto: CreateServiceStoreDto) {
    return await factory.createOne(
      this.serviceStoreRepo,
      createServiceStoreDto,
    );
  }

  async findAllServiceStores(query: Partial<IQuery>) {
    return await factory.getAll(this.serviceStoreRepo, query);
  }

  async findServiceStoreById(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.serviceStoreRepo, id, query);
  }

  async updateServiceStore(
    id: string,
    updateServiceStoreDto: UpdateServiceStoreDto,
  ) {
    return await factory.updateOne(
      this.serviceStoreRepo,
      id,
      updateServiceStoreDto,
    );
  }

  async deleteServiceStore(id: string) {
    return await factory.deleteOne(this.serviceStoreRepo, id);
  }
}

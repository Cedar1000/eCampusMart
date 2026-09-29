import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    return await factory.createOne(this.serviceRepo, createServiceDto);
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
}

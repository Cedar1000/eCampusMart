import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { Repository } from 'typeorm';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { ServiceCategory } from './entities/service-category.entity';

@Injectable()
export class ServiceCategoryService {
  constructor(
    @InjectRepository(ServiceCategory)
    private readonly serviceCategoryRepo: Repository<ServiceCategory>,
  ) {}

  async createServiceCategory(
    createServiceCategoryDto: CreateServiceCategoryDto,
  ) {
    return await factory.createOne(
      this.serviceCategoryRepo,
      createServiceCategoryDto,
    );
  }

  async findAllServiceCategories(query: Partial<IQuery>) {
    return await factory.getAll(this.serviceCategoryRepo, query);
  }

  async findServiceCategoryById(id: string, query: Partial<IQuery>) {
    return await factory.getOne(this.serviceCategoryRepo, id, query);
  }

  async updateServiceCategory(
    id: string,
    updateServiceCategoryDto: UpdateServiceCategoryDto,
  ) {
    return await factory.updateOne(
      this.serviceCategoryRepo,
      id,
      updateServiceCategoryDto,
    );
  }

  async deleteServiceCategory(id: string) {
    return await factory.deleteOne(this.serviceCategoryRepo, id);
  }
}

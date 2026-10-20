import { ConflictException, Injectable } from '@nestjs/common';
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
    await this.assertNameIsFree(createServiceCategoryDto.name);

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
    if (updateServiceCategoryDto.name !== undefined) {
      await this.assertNameIsFree(updateServiceCategoryDto.name, id);
    }

    return await factory.updateOne(
      this.serviceCategoryRepo,
      id,
      updateServiceCategoryDto,
    );
  }

  async deleteServiceCategory(id: string) {
    return await factory.deleteOne(this.serviceCategoryRepo, id);
  }

  // Names are unique ignoring case and spaces; exceptId lets a category keep its own
  private async assertNameIsFree(name: string, exceptId?: string) {
    const query = this.serviceCategoryRepo
      .createQueryBuilder('category')
      .where('LOWER(TRIM(category.name)) = LOWER(TRIM(:name))', { name });

    if (exceptId) query.andWhere('category.id <> :exceptId', { exceptId });

    if (await query.getExists()) {
      throw new ConflictException('A category with that name already exists');
    }
  }
}

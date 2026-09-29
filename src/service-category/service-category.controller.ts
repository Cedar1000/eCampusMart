import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type IQuery from 'interfaces/query.Interface';
import { ServiceCategoryService } from './service-category.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';

@Controller('service-categories')
export class ServiceCategoryController {
  constructor(
    private readonly serviceCategoryService: ServiceCategoryService,
  ) {}

  @Post()
  @UsePipes(ValidationPipe)
  create(@Body() createServiceCategoryDto: CreateServiceCategoryDto) {
    return this.serviceCategoryService.createServiceCategory(
      createServiceCategoryDto,
    );
  }

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    if (query.search) query.search = `name,${query.search}`;

    return this.serviceCategoryService.findAllServiceCategories(query);
  }

  @Get(':id')
  findOneById(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    return this.serviceCategoryService.findServiceCategoryById(id, query);
  }

  @Patch(':id')
  @UsePipes(ValidationPipe)
  update(
    @Param('id') id: string,
    @Body() updateServiceCategoryDto: UpdateServiceCategoryDto,
  ) {
    return this.serviceCategoryService.updateServiceCategory(
      id,
      updateServiceCategoryDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceCategoryService.deleteServiceCategory(id);
  }
}

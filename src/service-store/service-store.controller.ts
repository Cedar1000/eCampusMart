import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  Delete,
  UsePipes,
  UseGuards,
  Controller,
  ValidationPipe,
} from '@nestjs/common';

import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';

import { User } from 'src/auth/entities/user.entity';
import { ServiceStoreService } from './service-store.service';
import { CreateServiceStoreDto } from './dto/create-service-store.dto';
import { UpdateServiceStoreDto } from './dto/update-service-store.dto';
import { ValidServiceCategoryGuard } from './guards/valid-service-category.guard';
import { UniqueServiceStoreGuard } from './guards/unique-service-store.guard';

@Controller('service-stores')
export class ServiceStoreController {
  constructor(private readonly serviceStoreService: ServiceStoreService) {}

  @Post()
  @UseGuards(ValidServiceCategoryGuard)
  @UsePipes(ValidationPipe)
  create(
    @Body() createServiceStoreDto: CreateServiceStoreDto,
    @CurrentUser() user: User,
  ) {
    createServiceStoreDto.ownerId = user.id;
    createServiceStoreDto.campusId = user.campusId;

    return this.serviceStoreService.createServiceStore(createServiceStoreDto);
  }

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    if (query.search) query.search = `name,${query.search}`;

    return this.serviceStoreService.findAllServiceStores(query);
  }

  @Get(':id')
  findOneById(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    return this.serviceStoreService.findServiceStoreById(id, query);
  }

  @Patch(':id')
  @UsePipes(ValidationPipe)
  update(
    @Param('id') id: string,
    @Body() updateServiceStoreDto: UpdateServiceStoreDto,
  ) {
    return this.serviceStoreService.updateServiceStore(
      id,
      updateServiceStoreDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceStoreService.deleteServiceStore(id);
  }
}

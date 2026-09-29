import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ValidServiceCategoryGuard } from './guards/valid-service-category.guard';
import { ValidServiceStoreGuard } from './guards/valid-service-store.guard';

@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @UseGuards(ValidServiceStoreGuard, ValidServiceCategoryGuard)
  @UsePipes(ValidationPipe)
  create(
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() user: User,
  ) {
    createServiceDto.ownerId = user.id;
    createServiceDto.campusId = user.campusId;

    console.log({ createServiceDto });

    return this.serviceService.create(createServiceDto);
  }

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    if (query.search) query.search = `title,${query.search}`;

    return this.serviceService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    return this.serviceService.findOne(id, query);
  }

  @Patch(':id')
  @UsePipes(ValidationPipe)
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.serviceService.update(id, updateServiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }
}

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
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { withRelations } from 'utils/withRelations';
import { User } from 'src/auth/entities/user.entity';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ValidServiceStoreGuard } from './guards/valid-service-store.guard';
import { IncludeIsLikedServiceInterceptor } from './interceptors/has-liked-service.interceptor';
import { ValidServiceOwnerGuard } from './guards/valid-service-owner.guard';

@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @UseGuards(ValidServiceStoreGuard)
  @UsePipes(ValidationPipe)
  create(
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() user: User,
  ) {
    createServiceDto.ownerId = user.id;
    createServiceDto.campusId = user.campusId;

    return this.serviceService.create(createServiceDto);
  }

  @Get()
  @UseInterceptors(IncludeIsLikedServiceInterceptor)
  findAll(
    @Query() query: IQuery & { ownerId?: string; storeId?: string },
    @CurrentUser() user: User,
  ) {
    query.relations = withRelations(query.relations, ['images'], ['store']);

    if (query.search) query.search = `title,${query.search}`;

    return this.serviceService.findListed(query, user.id);
  }

  @Get('my-listings')
  myListings(
    @Query() query: IQuery & { ownerId: string },
    @CurrentUser() user: User,
  ) {
    query.relations = withRelations(query.relations, ['images'], ['store']);
    query.ownerId = user.id;

    if (query.search) query.search = `title,${query.search}`;

    return this.serviceService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(IncludeIsLikedServiceInterceptor)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: IQuery) {
    query.relations = withRelations(query.relations, ['images'], ['store']);

    return this.serviceService.findOne(id, query);
  }

  @Patch(':id')
  @UseGuards(ValidServiceStoreGuard)
  @UsePipes(ValidationPipe)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.serviceService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(ValidServiceOwnerGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceService.remove(id);
  }
}

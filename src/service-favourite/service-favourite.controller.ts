import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceFavouriteService } from './service-favourite.service';
import { CreateServiceFavouriteDto } from './dto/create-service-favourite.dto';
import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ValidServiceGuard } from './guards/validate-service.guard';
import { IncludeFavouriteServiceInterceptor } from './interceptors/include-favourite-service.interceptor';

@Controller('service-favourites')
export class ServiceFavouriteController {
  constructor(
    private readonly serviceFavouriteService: ServiceFavouriteService,
  ) {}

  @Post()
  @UseGuards(ValidServiceGuard)
  create(
    @Body() createServiceFavouriteDto: CreateServiceFavouriteDto,
    @CurrentUser() user: User,
  ) {
    createServiceFavouriteDto.userId = user.id;
    return this.serviceFavouriteService.create(createServiceFavouriteDto, user);
  }

  @Get('my-favourites')
  @UseInterceptors(IncludeFavouriteServiceInterceptor)
  findAll(@Query() query: IQuery, @CurrentUser() user: User) {
    query.userId = user.id;
    return this.serviceFavouriteService.findAll(query);
  }

  @Delete(':serviceId')
  remove(@Param('serviceId') serviceId: string, @CurrentUser() user: User) {
    return this.serviceFavouriteService.remove(serviceId, user);
  }
}

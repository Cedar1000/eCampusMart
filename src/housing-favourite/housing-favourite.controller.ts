import {
  Get,
  Post,
  Body,
  Query,
  Param,
  Delete,
  Controller,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { HousingFavouriteService } from './housing-favourite.service';
import { CreateHousingFavouriteDto } from './dto/create-housing-favourite.dto';

import type IQuery from 'interfaces/query.Interface';
import { ValidHousingGuard } from './guards/validate-housing.guard';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';

import { IncludeFavouriteHousingInterceptor } from './interceptors/include-favourite-housing.interceptor';

@Controller('housing-favourites')
export class HousingFavouriteController {
  constructor(
    private readonly housingFavouriteService: HousingFavouriteService,
  ) {}

  @Post()
  @UseGuards(ValidHousingGuard)
  create(
    @Body() createHousingFavouriteDto: CreateHousingFavouriteDto,
    @CurrentUser() user: User,
  ) {
    createHousingFavouriteDto.userId = user.id;
    return this.housingFavouriteService.create(createHousingFavouriteDto, user);
  }

  @Get('my-favourites')
  @UseInterceptors(IncludeFavouriteHousingInterceptor)
  findAll(@Query() query: IQuery, @CurrentUser() user: User) {
    query.userId = user.id;
    return this.housingFavouriteService.findAll(query);
  }

  @Delete(':housingId')
  remove(@Param('housingId') housingId: string, @CurrentUser() user: User) {
    return this.housingFavouriteService.remove(housingId, user);
  }
}

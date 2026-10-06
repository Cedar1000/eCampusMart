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

import { ProductFavouriteService } from './product-favourite.service';
import { CreateProductFavouriteDto } from './dto/create-product-favourite.dto';

import type IQuery from 'interfaces/query.Interface';
import { ValidProductGuard } from './guards/validate-product.guard';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { IncludeFavouriteProductInterceptor } from './interceptors/include-favourite-product.interceptor';

@Controller('product-favourites')
export class ProductFavouriteController {
  constructor(
    private readonly productFavouriteService: ProductFavouriteService,
  ) {}

  @Post()
  @UseGuards(ValidProductGuard)
  create(
    @Body() createProductFavouriteDto: CreateProductFavouriteDto,
    @CurrentUser() user: User,
  ) {
    createProductFavouriteDto.userId = user.id;
    return this.productFavouriteService.create(createProductFavouriteDto, user);
  }

  @Get('my-favourites')
  @UseInterceptors(IncludeFavouriteProductInterceptor)
  findAll(@Query() query: IQuery, @CurrentUser() user: User) {
    query.userId = user.id;
    return this.productFavouriteService.findAll(query);
  }

  @Delete(':productId')
  remove(@Param('productId') productId: string, @CurrentUser() user: User) {
    return this.productFavouriteService.remove(productId, user);
  }
}

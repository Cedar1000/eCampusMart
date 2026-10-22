import {
  Get,
  Post,
  Body,
  Query,
  Patch,
  Param,
  Delete,
  Controller,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';

import { ProductService } from './product.service';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { withRelations } from 'utils/withRelations';
import { User } from 'src/auth/entities/user.entity';

import { ProductUserDetailsInterceptor } from './interceptors/product-user-details.interceptor';
import { ValidProductStoreGuard } from './guards/valid-product-store.guard';
import { ValidProductCategoryGuard } from './guards/valid-product-category.guard';
import { IncludeIsLikedInterceptor } from './interceptors/has-liked-product.interceptor';
import { ValidProductOwnerGuard } from './guards/valid-product-owner.guard';
import { HasProductUploadBalanceGuard } from './guards/has-product-upload-balance.guard';
import { HasCampusGuard } from 'src/common/guards/has-campus.guard';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(
    HasCampusGuard,
    HasProductUploadBalanceGuard,
    ValidProductCategoryGuard,
  )
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    createProductDto.userId = user.id;
    createProductDto.campusId = user.campusId;

    return this.productService.create(createProductDto);
  }

  @Post('create-store-product')
  @UseGuards(
    HasCampusGuard,
    HasProductUploadBalanceGuard,
    ValidProductStoreGuard,
  )
  createStoreProduct(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    createProductDto.userId = user.id;
    createProductDto.campusId = user.campusId;
    createProductDto.isStoreProduct = true;

    return this.productService.create(createProductDto);
  }

  @Get()
  @UseInterceptors(ProductUserDetailsInterceptor, IncludeIsLikedInterceptor)
  findAll(@Query() query: IQuery) {
    query.relations = withRelations(query.relations, ['images'], ['store']);
    query.status = 'active';

    if (query.search) {
      query.search = `name,${query.search}-description,${query.search}`;
    }
    return this.productService.findAll(query);
  }

  @Get('/my-listings')
  @UseInterceptors(ProductUserDetailsInterceptor)
  myListings(@Query() query: IQuery, @CurrentUser() user: User) {
    query.relations = withRelations(query.relations, ['images'], ['store']);
    query.status = 'active';
    query.userId = user.id;
    return this.productService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(ProductUserDetailsInterceptor, IncludeIsLikedInterceptor)
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: IQuery) {
    query.relations = withRelations(query.relations, ['images'], ['store']);
    return this.productService.findOne(id, query);
  }

  @Patch(':id')
  @UseGuards(ValidProductOwnerGuard, ValidProductStoreGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const { storeId } = updateProductDto;

    if (storeId) updateProductDto.isStoreProduct = true;

    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(ValidProductOwnerGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.remove(id);
  }
}

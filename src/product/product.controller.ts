import {
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Controller,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { ProductService } from './product.service';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ProductUserDetailsInterceptor } from './interceptors/product-user-details.interceptor';
import { ValidProductCategoryGuard } from './guards/valid-product-category.guard';
import { ValidProductStoreGuard } from './guards/valid-product-store.guard';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(ValidProductCategoryGuard)
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    createProductDto.userId = user.id;
    createProductDto.campusId = user.campusId;

    return this.productService.create(createProductDto);
  }

  @Post('create-store-product')
  @UseGuards(ValidProductStoreGuard)
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
  @UseInterceptors(ProductUserDetailsInterceptor)
  findAll(@Query() query: Partial<IQuery>) {
    query.relations = 'images';
    query.status = 'active';
    return this.productService.findAll(query);
  }

  @Get('/my-listings')
  @UseInterceptors(ProductUserDetailsInterceptor)
  myListings(@Query() query: Partial<IQuery>, @CurrentUser() user: User) {
    query.relations = 'images';
    query.status = 'active';
    query.userId = user.id;
    return this.productService.findAll(query);
  }

  @Get(':id')
  @UseInterceptors(ProductUserDetailsInterceptor)
  findOne(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    query.relations = 'images';
    return this.productService.findOne(id, query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}

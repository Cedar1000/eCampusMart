import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  Delete,
  UsePipes,
  Controller,
  ValidationPipe,
} from '@nestjs/common';

import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import type IQuery from 'interfaces/query.Interface';

@Controller('product-categories')
export class ProductCategoryController {
  constructor(
    private readonly productCategoryService: ProductCategoryService,
  ) {}

  @Post()
  @UsePipes(ValidationPipe)
  create(@Body() createProductCategoryDto: CreateProductCategoryDto) {
    return this.productCategoryService.createProductCategory(
      createProductCategoryDto,
    );
  }

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    if (query.search) {
      query.search = `name,${query.search}`;
    }

    return this.productCategoryService.findAllProductCategories(query);
  }

  @Get(':id')
  findOneById(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    return this.productCategoryService.findProductCategoryById(id, query);
  }

  @Patch(':id')
  @UsePipes(ValidationPipe)
  update(
    @Param('id') id: string,
    @Body() updateProductCategoryDto: UpdateProductCategoryDto,
  ) {
    return this.productCategoryService.updateProductCategory(
      id,
      updateProductCategoryDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productCategoryService.deleteProductCategory(id);
  }
}

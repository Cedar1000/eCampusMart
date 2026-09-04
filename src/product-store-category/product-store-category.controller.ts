import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductStoreCategoryService } from './product-store-category.service';
import { CreateProductStoreCategoryDto } from './dto/create-product-store-category.dto';
import { UpdateProductStoreCategoryDto } from './dto/update-product-store-category.dto';

@Controller('product-store-category')
export class ProductStoreCategoryController {
  constructor(private readonly productStoreCategoryService: ProductStoreCategoryService) {}

  @Post()
  create(@Body() createProductStoreCategoryDto: CreateProductStoreCategoryDto) {
    return this.productStoreCategoryService.create(createProductStoreCategoryDto);
  }

  @Get()
  findAll() {
    return this.productStoreCategoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productStoreCategoryService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductStoreCategoryDto: UpdateProductStoreCategoryDto) {
    return this.productStoreCategoryService.update(+id, updateProductStoreCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productStoreCategoryService.remove(+id);
  }
}

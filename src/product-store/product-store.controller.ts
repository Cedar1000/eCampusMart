import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductStoreService } from './product-store.service';
import { CreateProductStoreDto } from './dto/create-product-store.dto';
import { UpdateProductStoreDto } from './dto/update-product-store.dto';

@Controller('product-store')
export class ProductStoreController {
  constructor(private readonly productStoreService: ProductStoreService) {}

  @Post()
  create(@Body() createProductStoreDto: CreateProductStoreDto) {
    return this.productStoreService.create(createProductStoreDto);
  }

  @Get()
  findAll() {
    return this.productStoreService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productStoreService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductStoreDto: UpdateProductStoreDto) {
    return this.productStoreService.update(+id, updateProductStoreDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productStoreService.remove(+id);
  }
}

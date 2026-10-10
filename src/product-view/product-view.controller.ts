import { Controller, Get, Post, Body } from '@nestjs/common';
import { ProductViewService } from './product-view.service';
import { CreateProductViewDto } from './dto/create-product-view.dto';

@Controller('product-view')
export class ProductViewController {
  constructor(private readonly productViewService: ProductViewService) {}

  @Post()
  create(@Body() createProductViewDto: CreateProductViewDto) {
    return this.productViewService.create(createProductViewDto);
  }

  @Get()
  findAll() {
    return this.productViewService.findAll();
  }
}

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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type IQuery from 'interfaces/query.Interface';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ProductStoreService } from './product-store.service';
import { CreateProductStoreDto } from './dto/create-product-store.dto';
import { UpdateProductStoreDto } from './dto/update-product-store.dto';
import { ValidProductCategoryGuard } from 'src/product/guards/valid-product-category.guard';

@Controller('product-stores')
export class ProductStoreController {
  constructor(private readonly productStoreService: ProductStoreService) {}

  @Post()
  @UseGuards(ValidProductCategoryGuard)
  @UsePipes(ValidationPipe)
  create(
    @Body() createProductStoreDto: CreateProductStoreDto,
    @CurrentUser() user: User,
  ) {
    createProductStoreDto.userId = user.id;

    return this.productStoreService.create(createProductStoreDto);
  }

  @Get()
  findAll(@Query() query: Partial<IQuery>) {
    if (query.search) query.search = `name,${query.search}`;

    return this.productStoreService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query() query: Partial<IQuery>) {
    return this.productStoreService.findOne(id, query);
  }

  @Patch(':id')
  @UsePipes(ValidationPipe)
  update(
    @Param('id') id: string,
    @Body() updateProductStoreDto: UpdateProductStoreDto,
  ) {
    return this.productStoreService.update(id, updateProductStoreDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productStoreService.remove(id);
  }
}

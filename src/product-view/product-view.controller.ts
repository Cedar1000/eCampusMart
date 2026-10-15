import { Controller, Post, Body } from '@nestjs/common';
import { ProductViewService } from './product-view.service';
import { CreateProductViewDto } from './dto/create-product-view.dto';
import { CurrentUser } from 'src/auth/decorators/get-current-user.decorator';
import { User } from 'src/auth/entities/user.entity';

@Controller('product-views')
export class ProductViewController {
  constructor(private readonly productViewService: ProductViewService) {}

  @Post()
  create(@Body() dto: CreateProductViewDto, @CurrentUser() user: User) {
    return this.productViewService.recordView(dto.productId, user.id);
  }
}

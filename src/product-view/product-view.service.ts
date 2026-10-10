import { Injectable } from '@nestjs/common';
import { CreateProductViewDto } from './dto/create-product-view.dto';
import { ProductView } from './entities/product-view.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import * as factory from 'utils/handlerFactory';

@Injectable()
export class ProductViewService {
  constructor(
    @InjectRepository(ProductView)
    private readonly productViewRepo: Repository<ProductView>,
  ) {}

  async create(dto: CreateProductViewDto) {
    const data = await factory.createOne(this.productViewRepo, dto);

    const view = data.data as ProductView;

    const { productId } = view;

    const viewCount = await this.productViewRepo.count({
      where: { productId },
    });

    return viewCount;
  }

  findAll() {
    return `This action returns all productView`;
  }
}

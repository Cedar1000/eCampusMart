import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';

@Injectable()
export class ValidProductCategoryGuard implements CanActivate {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepository: Repository<ProductCategory>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { categoryId } = request.body;

    if (!categoryId) return true;

    const category = await this.productCategoryRepository.findOne({
      where: { id: String(categoryId) },
      select: ['id'],
    });

    if (!category) {
      throw new NotFoundException('Product category not found');
    }

    return true;
  }
}

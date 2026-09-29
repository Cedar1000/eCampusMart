import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceCategory } from 'src/service-category/entities/service-category.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ValidServiceCategoryGuard implements CanActivate {
  constructor(
    @InjectRepository(ServiceCategory)
    private readonly serviceCategoryRepository: Repository<ServiceCategory>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { categoryId } = request.body;

    if (!categoryId) return true;

    const category = await this.serviceCategoryRepository.findOne({
      where: { id: String(categoryId) },
      select: ['id'],
    });

    if (!category) throw new NotFoundException('Service category not found');

    return true;
  }
}

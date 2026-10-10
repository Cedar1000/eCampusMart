import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Housing } from 'src/housing/entities/housing.entity';

@Injectable()
export class ValidHousingGuard implements CanActivate {
  constructor(
    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const { housingId } = request.body;

    const housing = await this.housingRepo.findOne({
      where: { id: String(housingId) },
      select: ['id'],
    });

    if (!housing) {
      throw new NotFoundException('housing category not found');
    }

    return true;
  }
}

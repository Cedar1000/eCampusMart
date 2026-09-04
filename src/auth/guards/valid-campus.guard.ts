import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Campus } from 'src/campus/entities/campus.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ValidCampusGuard implements CanActivate {
  constructor(
    @InjectRepository(Campus)
    private readonly campusRepository: Repository<Campus>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { campusId } = request.body;

    if (!campusId) return true;

    const campus = await this.campusRepository.findOne({
      where: { id: String(campusId) },
      select: ['id'],
    });

    if (!campus) throw new NotFoundException('Campus not found');

    return true;
  }
}

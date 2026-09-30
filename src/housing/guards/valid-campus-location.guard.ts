import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampusLocation } from 'src/campus-location/entities/campus-location.entity';

@Injectable()
export class ValidCampusLocationGuard implements CanActivate {
  constructor(
    @InjectRepository(CampusLocation)
    private readonly campusLocationRepository: Repository<CampusLocation>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { locationId } = request.body;

    if (!locationId) return true;

    const campusLocation = await this.campusLocationRepository.findOne({
      where: { id: String(locationId) },
      select: ['id', 'campusId'],
    });

    if (!campusLocation) {
      throw new NotFoundException('Campus location not found');
    }

    request.body.campusId = campusLocation.campusId;

    return true;
  }
}

import { PartialType } from '@nestjs/mapped-types';
import { CreateCampusLocationDto } from './create-campus-location.dto';

export class UpdateCampusLocationDto extends PartialType(
  CreateCampusLocationDto,
) {}

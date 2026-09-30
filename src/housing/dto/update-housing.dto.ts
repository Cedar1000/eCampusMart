import { PartialType } from '@nestjs/mapped-types';
import { CreateHousingDto } from './create-housing.dto';

export class UpdateHousingDto extends PartialType(CreateHousingDto) {}

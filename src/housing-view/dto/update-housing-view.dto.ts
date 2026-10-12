import { PartialType } from '@nestjs/mapped-types';
import { CreateHousingViewDto } from './create-housing-view.dto';

export class UpdateHousingViewDto extends PartialType(CreateHousingViewDto) {}

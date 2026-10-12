import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceViewDto } from './create-service-view.dto';

export class UpdateServiceViewDto extends PartialType(CreateServiceViewDto) {}

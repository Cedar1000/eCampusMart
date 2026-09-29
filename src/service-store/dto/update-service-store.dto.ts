import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceStoreDto } from './create-service-store.dto';

export class UpdateServiceStoreDto extends PartialType(CreateServiceStoreDto) {}

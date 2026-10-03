import {
  IsUUID,
  IsObject,
  IsString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

import type { ServiceAvailability } from '../entities/service-store.entity';

export class CreateServiceStoreDto {
  @IsOptional()
  @IsUUID()
  ownerId: string;

  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  campusId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  logo: string;

  @IsOptional()
  @IsString()
  logoKey: string;

  @IsOptional()
  @IsString()
  banner: string;

  @IsOptional()
  @IsString()
  bannerKey: string;

  @IsOptional()
  @IsObject()
  availability?: ServiceAvailability;
}

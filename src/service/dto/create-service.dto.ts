import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import type { ServiceAvailability } from '../entities/service.entity';
import { PriceUnit } from '../enums/price.enum';
import { ServiceImage } from '../entities/service-image.entity';

export class CreateServiceDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsUUID()
  categoryId: string;

  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsBoolean()
  isNegotiable: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsNotEmpty()
  @IsEnum(PriceUnit)
  priceUnit: PriceUnit;

  @IsOptional()
  @IsObject()
  availability?: ServiceAvailability;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsNotEmpty()
  @IsArray()
  images?: ServiceImage[];
}

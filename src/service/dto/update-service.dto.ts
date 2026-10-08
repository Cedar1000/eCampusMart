import {
  IsEnum,
  IsUUID,
  IsArray,
  IsNumber,
  IsString,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

import { PriceUnit } from '../enums/price.enum';

import { ServiceImage } from '../entities/service-image.entity';

export class UpdateServiceDto {
  @IsNotEmpty()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isNegotiable?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  price?: number;

  @IsNotEmpty()
  @IsEnum(PriceUnit)
  priceUnit?: PriceUnit;

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

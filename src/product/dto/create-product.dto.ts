import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ProductCondition } from '../enums/product-condition.enum';

import { Transform } from 'class-transformer';
import { ProductImage } from '../entities/product-image.entity';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => (value as string).toLowerCase())
  name: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  campusId: string;

  @IsOptional()
  @IsBoolean()
  isStoreProduct: boolean;

  @IsOptional()
  @IsString()
  storeCategoryId: string;

  @IsOptional()
  @IsEnum(ProductCondition)
  condition: ProductCondition;

  @IsNotEmpty()
  @IsArray()
  images?: ProductImage[];
}

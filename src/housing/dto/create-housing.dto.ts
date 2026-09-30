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
import { HousingImage } from '../entities/housing-image.entity';
import { HouseType } from '../enums/house-type.enum';
import { PricePeriod } from '../enums/price-period.enum';

export class CreateHousingDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsEnum(HouseType)
  houseType: HouseType;

  @IsNotEmpty()
  @IsUUID()
  locationId: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  whoCanRent?: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  isNegotiable?: boolean;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsNotEmpty()
  @IsEnum(PricePeriod)
  pricePeriod: PricePeriod;

  @IsNotEmpty()
  @IsArray()
  images: HousingImage[];
}

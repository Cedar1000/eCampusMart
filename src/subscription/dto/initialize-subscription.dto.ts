import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class InitializeSubscriptionDto {
  @IsNotEmpty()
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  callbackUrl?: string;
}

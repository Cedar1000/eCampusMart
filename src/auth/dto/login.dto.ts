import { Transform } from 'class-transformer';

import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsLowercase,
} from 'class-validator';

export class EmailLoginDto {
  @IsOptional()
  @IsEmail()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsLowercase()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  payload: { email: string };
}

export class PhoneNumberLoginDto {
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  payload: { countryCode: string; phoneNumber: string };
}

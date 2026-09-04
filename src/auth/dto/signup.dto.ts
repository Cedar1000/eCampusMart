import { Entity } from 'typeorm';

import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';

@Entity()
export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsUUID()
  @IsOptional()
  campusId: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  countryCode: string;
}

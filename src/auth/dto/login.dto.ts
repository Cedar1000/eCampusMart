import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsLowercase,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsLowercase()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role: UserRole;
}

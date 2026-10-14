import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyChangeEmailDto {
  @IsNotEmpty()
  otp: number;
}

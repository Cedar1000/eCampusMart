import { Transform } from 'class-transformer';
import { IsEmail, IsLowercase, IsNotEmpty } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsLowercase()
  email: string;

  @IsNotEmpty()
  otp: number;
}

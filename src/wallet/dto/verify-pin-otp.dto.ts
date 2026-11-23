import { IsString, Matches } from 'class-validator';

export class VerifyPinOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must contain exactly 6 digits' })
  otp: string;
}

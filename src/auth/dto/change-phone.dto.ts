import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePhoneDto {
  @IsString()
  @Matches(/^\d{7,15}$/)
  phoneNumber: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{0,3}$/)
  @MaxLength(5)
  countryCode: string;
}

export class VerifyPhoneChangeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  otp: string;
}

import { Transform, Type } from 'class-transformer';

import {
  Max,
  Min,
  IsUUID,
  Length,
  Matches,
  IsNumber,
  IsString,
} from 'class-validator';

export class WithdrawWalletDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  // The amount is converted from naira to kobo before validation.
  @Min(100_000, { message: 'Minimum withdrawal amount is ₦1,000' })
  @Max(500_000_00, { message: 'Maximum withdrawal amount is ₦500,000' })
  @Transform(({ value }) => Math.round(Number(value) * 100))
  amount: number;

  @IsUUID()
  accountId: string;

  @IsString()
  @Matches(/^\d{4,4}$/)
  @Length(4, 4, { message: 'PIN must be 4 digits' })
  pin: string;
}

export class FinalizeWithdrawalDto {
  @IsString()
  @Matches(/^\d{4,8}$/)
  otp: string;
}

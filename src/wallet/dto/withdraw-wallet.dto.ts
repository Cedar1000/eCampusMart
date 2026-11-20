import { Transform, Type } from 'class-transformer';
import { IsNumber, IsString, Matches, Max, Min } from 'class-validator';

export class WithdrawWalletDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10_000)
  @Max(1_000_000_000)
  @Transform(({ value }) => Math.round(Number(value) * 100))
  amount: number;

  @IsString()
  @Matches(/^\d{10}$/)
  accountNumber: string;

  @IsString()
  bankCode: string;

  @IsString()
  @Matches(/^\d{4,6}$/)
  pin: string;
}

export class FinalizeWithdrawalDto {
  @IsString()
  @Matches(/^\d{4,8}$/)
  otp: string;
}

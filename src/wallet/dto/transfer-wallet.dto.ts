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

export class TransferWalletDto {
  @IsUUID()
  recipientId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  @Max(1_000_000_000)
  @Transform(({ value }) => Math.round(Number(value) * 100))
  amount: number;

  @IsString()
  @Matches(/^\d{4,4}$/)
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

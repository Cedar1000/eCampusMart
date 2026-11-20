import { Transform, Type } from 'class-transformer';
import { IsNumber, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

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
  @Matches(/^\d{4,6}$/)
  pin: string;
}

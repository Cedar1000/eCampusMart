import { IsString, Matches } from 'class-validator';

export class TransactionPinDto {
  @IsString()
  @Matches(/^\d{4,6}$/)
  pin: string;
}

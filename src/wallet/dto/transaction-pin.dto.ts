import { IsString, Length, Matches } from 'class-validator';

export class TransactionPinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must contain exactly 4 digits' })
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

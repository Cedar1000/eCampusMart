import { IsString, Matches } from 'class-validator';

export class UpdateTransactionPinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Current PIN must contain exactly 4 digits' })
  currentPin: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'New PIN must contain exactly 4 digits' })
  newPin: string;
}

import { PartialType } from '@nestjs/mapped-types';
import { IsString, Length, Matches } from 'class-validator';
import { CreateBankAccountDto } from './create-bank-account.dto';

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {
  @IsString()
  @Matches(/^\d{4,4}$/)
  @Length(4, 4, { message: 'PIN must be 4 digits' })
  pin: string;
}

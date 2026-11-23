import { PartialType } from '@nestjs/mapped-types';
import { IsString, Matches } from 'class-validator';
import { CreateBankAccountDto } from './create-bank-account.dto';

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {
  @IsString()
  @Matches(/^\d{4,6}$/)
  pin: string;
}

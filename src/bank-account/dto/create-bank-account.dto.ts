import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBankAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountName: string;

  @IsString()
  @Matches(/^\d{10}$/)
  accountNumber: string;

  @IsString()
  @Length(3, 10)
  bankCode: string;

  @IsString()
  @MaxLength(120)
  bankName: string;
}

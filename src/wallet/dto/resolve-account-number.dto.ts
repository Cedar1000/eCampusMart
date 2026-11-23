import { IsString, Length, Matches } from 'class-validator';

export class ResolveAccountNumberDto {
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'accountNumber must be a valid 10-digit Nigerian account number',
  })
  accountNumber: string;

  @IsString()
  @Length(3, 10)
  bankCode: string;
}

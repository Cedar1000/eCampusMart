import { IsString, Matches } from 'class-validator';

export class VerifyBvnDto {
  @IsString()
  @Matches(/^\d{11}$/)
  bvn: string;

  @IsString()
  @Matches(/^\d{10}$/)
  accountNumber: string;

  @IsString()
  bankCode: string;
}

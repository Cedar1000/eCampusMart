import { Transform } from 'class-transformer';
import { IsString, IsLowercase, IsNotEmpty } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsLowercase()
  email: string;
}

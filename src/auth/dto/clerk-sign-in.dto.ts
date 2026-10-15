import { IsNotEmpty, IsString } from 'class-validator';

export class ClerkSignInDto {
  @IsNotEmpty()
  @IsString()
  token!: string;
}

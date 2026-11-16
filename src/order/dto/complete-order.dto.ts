import { IsJWT } from 'class-validator';

export class CompleteOrderDto {
  @IsJWT()
  token: string;
}

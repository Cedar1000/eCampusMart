import { IsNotEmpty, IsUUID } from 'class-validator';

export class CancelSubscriptionDto {
  @IsNotEmpty()
  @IsUUID()
  storeId: string;
}

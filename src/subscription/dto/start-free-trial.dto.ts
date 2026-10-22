import { IsNotEmpty, IsUUID } from 'class-validator';

export class StartFreeTrialDto {
  @IsNotEmpty()
  @IsUUID()
  storeId: string;
}

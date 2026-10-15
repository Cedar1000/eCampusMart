import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateHousingViewDto {
  @IsNotEmpty()
  @IsUUID()
  housingId: string;
}

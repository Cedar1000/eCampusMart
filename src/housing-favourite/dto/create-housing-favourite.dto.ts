import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateHousingFavouriteDto {
  @IsNotEmpty()
  @IsUUID()
  housingId: string;

  @IsOptional()
  @IsUUID()
  userId: string;
}

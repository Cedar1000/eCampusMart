import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateServiceFavouriteDto {
  @IsNotEmpty()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

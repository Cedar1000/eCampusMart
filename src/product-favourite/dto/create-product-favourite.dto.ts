import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateProductFavouriteDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  userId: string;
}

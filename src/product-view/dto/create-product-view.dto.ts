import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateProductViewDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsNotEmpty()
  @IsUUID()
  userId: string;
}

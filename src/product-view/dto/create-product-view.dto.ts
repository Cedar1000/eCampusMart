import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateProductViewDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;
}

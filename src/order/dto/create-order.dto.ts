import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

// Everything else (seller, store, amount) comes from the product, and the buyer is
// the logged-in user; status and expiresAt are set by the server
export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}

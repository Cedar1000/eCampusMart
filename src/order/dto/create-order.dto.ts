import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

// Everything else (seller, store, amount) comes from the product, and the buyer is
// the logged-in user; status and expiresAt are set by the server
export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  // Defaults to 1
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  metadata?: string;
}

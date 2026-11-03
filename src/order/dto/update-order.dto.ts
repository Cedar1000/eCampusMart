import { IsEnum, IsOptional, IsString } from 'class-validator';

import { OrderStatus } from '../enums/order-status.enum';

// Who and what the order is for can't change once it's created
export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  metadata?: string;
}

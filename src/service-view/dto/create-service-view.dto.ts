import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateServiceViewDto {
  @IsNotEmpty()
  @IsUUID()
  serviceId?: string;

  @IsNotEmpty()
  @IsUUID()
  userId?: string;
}

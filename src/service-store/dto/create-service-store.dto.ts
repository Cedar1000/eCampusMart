import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateServiceStoreDto {
  @IsOptional()
  @IsUUID()
  ownerId: string;

  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  campusId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  logo: string;

  @IsOptional()
  @IsString()
  logoKey: string;

  @IsOptional()
  @IsString()
  banner: string;

  @IsOptional()
  @IsString()
  bannerKey: string;
}

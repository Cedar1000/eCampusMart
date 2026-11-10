import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Send one of the two: pendingReviewId to review an order, or serviceStoreId
// to review a service store you've chatted with
export class CreateReviewDto {
  @ValidateIf((dto: CreateReviewDto) => !dto.serviceStoreId)
  @IsUUID()
  pendingReviewId?: string;

  @ValidateIf((dto: CreateReviewDto) => !dto.pendingReviewId)
  @IsUUID()
  serviceStoreId?: string;

  // Optional, with serviceStoreId: the store's service being reviewed
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;
}

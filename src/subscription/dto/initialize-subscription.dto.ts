import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';
import {
  IsEnum,
  IsNotEmpty,
  ValidateIf,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class InitializeSubscriptionDto {
  // Either a plan id or the plan type ("monthly" / "yearly") the app sends
  @ValidateIf((dto: InitializeSubscriptionDto) => !dto.plan)
  @IsNotEmpty()
  @IsUUID()
  planId: string;

  @ValidateIf((dto: InitializeSubscriptionDto) => !dto.planId)
  @IsNotEmpty()
  @IsEnum(PlanType)
  plan?: PlanType;

  @IsOptional()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  callbackUrl?: string;
}

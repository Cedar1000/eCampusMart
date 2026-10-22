import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class StartFreeTrialDto {
  // Reference of the card-check charge the app made with Paystack
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  reference: string;

  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  // The plan billed when the trial ends: a plan id or the plan type ("monthly" / "yearly")
  @ValidateIf((dto: StartFreeTrialDto) => !dto.plan)
  @IsNotEmpty()
  @IsUUID()
  planId?: string;

  @ValidateIf((dto: StartFreeTrialDto) => !dto.planId)
  @IsNotEmpty()
  @IsEnum(PlanType)
  plan?: PlanType;
}

import { PlanType } from 'src/subscription-plan/enums/plan-type.enum';
import { IsEnum, IsNotEmpty, IsUUID, ValidateIf } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  // Either a plan id or the plan type ("monthly" / "yearly") the app sends
  @ValidateIf((dto: ChangeSubscriptionPlanDto) => !dto.plan)
  @IsNotEmpty()
  @IsUUID()
  planId?: string;

  @ValidateIf((dto: ChangeSubscriptionPlanDto) => !dto.planId)
  @IsNotEmpty()
  @IsEnum(PlanType)
  plan?: PlanType;
}

import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateUserDetailsDto {
  @IsOptional()
  @IsUUID()
  campusId: string;

  @IsOptional()
  @IsBoolean()
  hasEmailNotificationEnabled: boolean;

  @IsOptional()
  @IsBoolean()
  hasSMSNotificationsEnabled: boolean;

  @IsOptional()
  @IsBoolean()
  hasInAppNotificationEnabled: boolean;
}

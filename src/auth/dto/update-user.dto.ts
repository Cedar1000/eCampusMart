import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsUUID()
  @IsOptional()
  campusId: string;

  @IsString()
  @IsOptional()
  phoneNumber: string;

  @ValidateIf((payload: UpdateUserDto) => payload.phoneNumber !== undefined)
  @IsString()
  @IsNotEmpty()
  countryCode: string;
}

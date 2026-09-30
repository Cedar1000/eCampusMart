import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateCampusLocationDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsUUID()
  campusId: string;
}

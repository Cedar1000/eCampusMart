import { IsIn, IsOptional } from 'class-validator';

export const UPLOAD_PURPOSES = ['listing', 'chat'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export class SignUploadDto {
  // Where the file goes: listing photos (the default) or chat attachments
  @IsOptional()
  @IsIn(UPLOAD_PURPOSES)
  purpose?: UploadPurpose;
}

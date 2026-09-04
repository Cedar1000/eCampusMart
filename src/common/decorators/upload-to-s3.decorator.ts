// decorators/upload-to-s3.decorator.ts
import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { S3UploadInterceptor } from '../interceptors/s3-upload.interceptor';
import { S3UploadMultipleInterceptor } from '../interceptors/s3-upload-multiple.interceptor';

export function UploadToS3(fieldName: string = 'file') {
  return applyDecorators(
    UseInterceptors(FileInterceptor(fieldName)),
    UseInterceptors(S3UploadInterceptor),
  );
}

export function UploadMultipleToS3(
  fieldName: string = 'files',
  maxCount?: number,
) {
  return applyDecorators(
    UseInterceptors(FilesInterceptor(fieldName, maxCount)),
    UseInterceptors(S3UploadMultipleInterceptor),
  );
}

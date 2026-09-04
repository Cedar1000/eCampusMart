/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// interceptors/s3-upload.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

import { createS3Client } from 'utils/aws-s3';

@Injectable()
export class S3UploadInterceptor implements NestInterceptor {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    // Initialize S3 client
    this.s3Client = createS3Client();
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') as string;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Check if file exists
    if (!request.file) throw new BadRequestException('No file uploaded');

    try {
      // Generate unique filename
      const fileExtension = path.extname(request.file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const key = `uploads/${fileName}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: request.file.buffer,
        ContentType: request.file.mimetype,
        Metadata: {
          originalName: request.file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Generate the URL
      const fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

      // Add the URL to the request body
      request.body = {
        ...request.body,
        fileUrl,
        fileKey: key,
        fileName: request.file.originalname,
      };

      return next.handle();
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload file to S3: ${error.message}`,
      );
    }
  }
}

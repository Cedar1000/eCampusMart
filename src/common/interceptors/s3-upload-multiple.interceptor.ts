/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Injectable,
  CallHandler,
  NestInterceptor,
  ExecutionContext,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

import { createS3Client } from 'utils/aws-s3';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class S3UploadMultipleInterceptor implements NestInterceptor {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = createS3Client();

    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') as string;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Handle single file
    if (request.file) {
      const fileUrl = await this.uploadFile(request.file);
      request.body = {
        ...request.body,
        fileUrl,
      };
    }

    // Handle multiple files
    if (request.files && Array.isArray(request.files)) {
      const uploadPromises = request.files.map((file) => this.uploadFile(file));
      const fileUrls = await Promise.all(uploadPromises);

      request.body = {
        ...request.body,
        fileUrls,
      };
    }

    // Handle files object (for multiple fields)
    if (request.files && typeof request.files === 'object') {
      const fileUrls = {};
      for (const [fieldname, files] of Object.entries(request.files)) {
        if (Array.isArray(files)) {
          const urls = await Promise.all(
            files.map((file) => this.uploadFile(file as UploadedFile)),
          );
          fileUrls[fieldname] = urls.length === 1 ? urls[0] : urls;
        }
      }

      request.body = {
        ...request.body,
        ...fileUrls,
      };
    }

    return next.handle();
  }

  private async uploadFile(file: UploadedFile): Promise<string> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `uploads/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);

    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }
}

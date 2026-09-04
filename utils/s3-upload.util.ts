/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// utils/s3-upload.util.ts

import { PutObjectCommand } from '@aws-sdk/client-s3';

import { createS3Client } from './aws-s3';

// Use the actual bucket name instead of access point
const BUCKET_NAME = 'hr-resume-ai';

/**
 * Simple function to upload a file to S3 using bucket
 * @param fileBuffer - The file buffer to upload
 * @param fileName - Original file name
 * @param mimeType - File MIME type
 * @param folder - Optional folder path (e.g., 'cvs', 'documents')
 * @returns Promise with the file URL and key
 */
export async function uploadToS3(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'uploads',
): Promise<{ url: string; key: string }> {
  try {
    // Generate unique filename to avoid collisions
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
    const key = `${folder}/${timestamp}-${sanitizedName}`;

    const S3 = createS3Client();

    // Use Upload class for better handling
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await S3.send(command);

    // Construct the URL using the bucket
    const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    return { url, key };
  } catch (error) {
    console.log('ERROORR OH!');
    console.error(error);

    // Provide more specific error messages
    if (error.Code === 'AccessDenied') {
      throw new Error(
        `S3 Access Denied. Please ensure the IAM user 'hr-resume-ai' has the following permissions:\n` +
          `- s3:PutObject on bucket '${BUCKET_NAME}'\n` +
          `- s3:PutObjectAcl (if setting ACLs)\n` +
          `Check bucket policy and IAM permissions.`,
      );
    }
    if (error.Code === 'NoSuchBucket') {
      throw new Error(
        `S3 bucket '${BUCKET_NAME}' does not exist or you don't have access to it.`,
      );
    }
    if (error.Code === 'InvalidAccessKeyId') {
      throw new Error('AWS Access Key ID is invalid or expired.');
    }
    if (error.Code === 'SignatureDoesNotMatch') {
      throw new Error('AWS Secret Access Key is incorrect.');
    }

    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

// Optional: Add a function to generate a pre-signed URL for secure access
export function getS3Url(key: string): string {
  const region = process.env.AWS_REGION || 'us-west-1';
  return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
}

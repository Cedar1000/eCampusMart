import { S3Client } from '@aws-sdk/client-s3';

// Initialize S3 client with proper error checking
export function createS3Client() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  console.log({ region });

  // Validate credentials
  if (!region) {
    throw new Error('AWS_REGION environment variable is not set');
  }
  if (!accessKeyId) {
    throw new Error('AWS_ACCESS_KEY_ID environment variable is not set');
  }
  if (!secretAccessKey) {
    throw new Error('AWS_SECRET_ACCESS_KEY environment variable is not set');
  }

  console.log('Initializing S3 client with region:', region);
  console.log('Access Key ID exists:', !!accessKeyId);

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Required for access points
    forcePathStyle: true,
  });
}

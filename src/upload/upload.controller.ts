import { Controller, HttpCode, Post } from '@nestjs/common';
import { signCloudinaryUpload } from 'utils/cloudinary';

@Controller('uploads')
export class UploadController {
  // Logged-in users only (protect middleware); the signature expires after an hour
  @Post('signature')
  @HttpCode(200)
  getSignature() {
    return { status: 'success', data: signCloudinaryUpload() };
  }
}

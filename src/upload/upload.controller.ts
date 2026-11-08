import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { signCloudinaryUpload } from 'utils/cloudinary';
import { SignUploadDto } from './dto/sign-upload.dto';

@Controller('uploads')
export class UploadController {
  // Logged-in users only (protect middleware); the signature expires after an hour.
  // { "purpose": "chat" } signs the chat folder, so chat files stay apart from
  // listing photos
  @Post('signature')
  @HttpCode(200)
  getSignature(@Body() { purpose = 'listing' }: SignUploadDto) {
    return { status: 'success', data: signCloudinaryUpload(purpose) };
  }
}

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { SignUploadDto } from './dto/sign-upload.dto';
import { UploadController } from './upload.controller';

describe('UploadController', () => {
  const controller = new UploadController();

  beforeEach(() => {
    process.env.CLOUDINARY_API_SECRET = 'secret';
  });

  it('signs the listing folder by default', () => {
    expect(controller.getSignature({}).data.folder).toBe('ECampusMart');
  });

  it('signs the chat folder for a chat upload', () => {
    expect(controller.getSignature({ purpose: 'chat' }).data.folder).toBe(
      'ECampusMart/chat',
    );
  });

  it('refuses an unknown purpose', async () => {
    const errors = await validate(
      plainToInstance(SignUploadDto, { purpose: 'avatar' }),
    );

    expect(errors).toHaveLength(1);
  });
});

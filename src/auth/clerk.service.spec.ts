import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClerkService } from './clerk.service';

describe('ClerkService', () => {
  const withSecret = (secret?: string) =>
    new ClerkService({ get: () => secret } as never);

  it('rejects a malformed token with 401', async () => {
    await expect(
      withSecret('sk_test_x').getProfile('not.a.jwt'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('fails with 500 when the secret key is missing', async () => {
    await expect(withSecret().getProfile('not.a.jwt')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('rejects a webhook without a valid signature', async () => {
    await expect(
      withSecret('whsec_dGVzdA==').verifyWebhook(Buffer.from('{}'), {}),
    ).rejects.toThrow(UnauthorizedException);
  });
});

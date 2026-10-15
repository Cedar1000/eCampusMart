import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, verifyToken } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';
import { isClerkAPIResponseError } from '@clerk/backend/errors';
import { verifyWebhook } from '@clerk/backend/webhooks';

export interface ClerkProfile {
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
}

@Injectable()
export class ClerkService {
  constructor(private readonly configService: ConfigService) {}

  // The verified Clerk user behind a session token; Clerk did the Google OAuth
  async getProfile(token: string): Promise<ClerkProfile> {
    const secretKey = this.getSecretKey();

    let clerkId: string;

    try {
      ({ sub: clerkId } = await verifyToken(token, { secretKey }));
    } catch (error) {
      // Clerk's error classes aren't shared between its entry points, so read the
      // reason instead; failing to load signing keys is our problem, not a bad token
      const { reason } = error as { reason?: unknown };

      if (
        typeof reason === 'string' &&
        (reason.startsWith('token-') || reason === 'jwk-kid-mismatch')
      ) {
        throw new UnauthorizedException('Invalid or expired Clerk token');
      }

      console.error('Clerk token verification failed', error);
      throw new InternalServerErrorException('Unable to verify Clerk token');
    }

    let user: Awaited<ReturnType<ClerkClient['users']['getUser']>>;

    try {
      user = await createClerkClient({ secretKey }).users.getUser(clerkId);
    } catch (error) {
      // The token is valid but its Clerk user was deleted since
      if (isClerkAPIResponseError(error) && error.status === 404) {
        throw new UnauthorizedException('Clerk user no longer exists');
      }

      throw error;
    }

    const email = user.primaryEmailAddress;

    if (!email || email.verification?.status !== 'verified') {
      throw new ForbiddenException('Your Google email is not verified');
    }

    return {
      clerkId,
      email: email.emailAddress.toLowerCase().trim(),
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      imageUrl: user.imageUrl,
    };
  }

  // Clerk signs webhooks with Svix; the raw body is needed to check the signature
  async verifyWebhook(rawBody: Buffer, headers: Record<string, unknown>) {
    const signingSecret = this.configService.get<string>(
      'CLERK_WEBHOOK_SIGNING_SECRET',
    );

    if (!signingSecret) {
      throw new InternalServerErrorException(
        'CLERK_WEBHOOK_SIGNING_SECRET is not configured',
      );
    }

    const request = new Request('https://clerk.webhook', {
      method: 'POST',
      headers: Object.entries(headers).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
      body: new Uint8Array(rawBody),
    });

    try {
      return await verifyWebhook(request, { signingSecret });
    } catch {
      throw new UnauthorizedException('Invalid Clerk webhook signature');
    }
  }

  private getSecretKey() {
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');

    if (!secretKey) {
      throw new InternalServerErrorException(
        'CLERK_SECRET_KEY is not configured',
      );
    }

    return secretKey;
  }
}

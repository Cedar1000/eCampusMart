import { HttpStatus, ValidationPipe } from '@nestjs/common';

import { User } from 'src/auth/entities/user.entity';
import { RemovePushTokenDto, SavePushTokenDto } from './dto/push-token.dto';
import { NotificationController } from './notification.controller';
import { PushService } from './push.service';

// Same options as the global pipe in main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validate = (metatype: new () => object, value: object) =>
  pipe.transform(value, { type: 'body', metatype });

const messages = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as { getResponse(): { message: string[] } }).getResponse()
      .message;
  }
  throw new Error('Expected the body to be refused');
};

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('push token bodies', () => {
  it('accepts an Expo token and platform', async () => {
    await expect(
      validate(SavePushTokenDto, { token: TOKEN, platform: 'android' }),
    ).resolves.toMatchObject({ token: TOKEN, platform: 'android' });
  });

  it('refuses a token that is not an Expo push token', async () => {
    expect(
      await messages(
        validate(SavePushTokenDto, { token: 'fcm-token', platform: 'ios' }),
      ),
    ).toContain('token must be an Expo push token');
  });

  it('refuses an unknown platform', async () => {
    expect(
      await messages(
        validate(SavePushTokenDto, { token: TOKEN, platform: 'web' }),
      ),
    ).toEqual([expect.stringContaining('platform must be one of')]);
  });

  it('only needs the token to remove one', async () => {
    await expect(
      validate(RemovePushTokenDto, { token: TOKEN }),
    ).resolves.toMatchObject({ token: TOKEN });
  });
});

describe('NotificationController', () => {
  const pushService = { saveToken: jest.fn(), removeToken: jest.fn() };
  const controller = new NotificationController(
    pushService as unknown as PushService,
  );
  const user = { id: 'user-1' } as User;
  const res = { status: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    [true, HttpStatus.CREATED],
    [false, HttpStatus.OK],
  ])('answers a token that is new: %s with %s', async (created, status) => {
    pushService.saveToken.mockResolvedValue(created);
    const body = { token: TOKEN, platform: 'ios' } as SavePushTokenDto;

    await controller.saveToken(body, user, res as never);

    expect(pushService.saveToken).toHaveBeenCalledWith('user-1', body);
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it("removes the current user's token", async () => {
    await controller.removeToken({ token: TOKEN }, user);

    expect(pushService.removeToken).toHaveBeenCalledWith('user-1', TOKEN);
  });
});

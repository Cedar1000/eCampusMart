import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { PushPlatform } from './entities/push-token.entity';
import { PUSH_RECEIPTS_JOB } from './notification.constants';
import { PushService } from './push.service';

const expo = {
  chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
  sendPushNotificationsAsync: jest.fn(),
  chunkPushNotificationReceiptIds: jest.fn((ids: string[]) => [ids]),
  getPushNotificationReceiptsAsync: jest.fn(),
};

jest.mock('expo-server-sdk', () => ({
  Expo: Object.assign(
    jest.fn(() => expo),
    { isExpoPushToken: () => true },
  ),
}));

const ANDROID = 'ExponentPushToken[android]';
const IPHONE = 'ExponentPushToken[iphone]';

describe('PushService', () => {
  let tokens: { token: string; userId: string; platform: PushPlatform }[];
  let repo: {
    update: jest.Mock;
    insert: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let queue: { add: jest.Mock };
  let service: PushService;

  const message = {
    title: 'Grace Drinks',
    body: 'Is this still available?',
    data: {
      type: 'chat-message' as const,
      conversationId: 'conversation-1',
      receiverId: 'user-1',
      messageId: 'message-1',
      sender: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tokens = [
      { token: ANDROID, userId: 'user-1', platform: PushPlatform.ANDROID },
      { token: IPHONE, userId: 'user-1', platform: PushPlatform.IOS },
    ];

    repo = {
      update: jest.fn(
        ({ token }: { token: string }, values: { userId: string }) => {
          const row = tokens.find((t) => t.token === token);
          if (row) Object.assign(row, values);
          return { affected: row ? 1 : 0 };
        },
      ),
      insert: jest.fn((row: (typeof tokens)[number]) => tokens.push(row)),
      delete: jest.fn(
        (where: { token: string | { _value: string[] }; userId?: string }) => {
          const remove =
            typeof where.token === 'string'
              ? [where.token]
              : where.token._value;
          tokens = tokens.filter(
            (t) =>
              !remove.includes(t.token) ||
              (where.userId !== undefined && t.userId !== where.userId),
          );
        },
      ),
      find: jest.fn(({ where }: { where: { userId: { _value: string[] } } }) =>
        tokens.filter((t) => where.userId._value.includes(t.userId)),
      ),
    };
    queue = { add: jest.fn() };
    service = new PushService(repo as never, queue as never);
  });

  describe('saveToken', () => {
    it('saves a new token', async () => {
      const created = await service.saveToken('user-2', {
        token: 'ExponentPushToken[new]',
        platform: PushPlatform.ANDROID,
      });

      expect(created).toBe(true);
      expect(tokens).toContainEqual({
        token: 'ExponentPushToken[new]',
        userId: 'user-2',
        platform: PushPlatform.ANDROID,
      });
    });

    it('moves a token to whoever signed in on that phone', async () => {
      const created = await service.saveToken('user-2', {
        token: ANDROID,
        platform: PushPlatform.ANDROID,
      });

      expect(created).toBe(false);
      expect(tokens.filter((t) => t.token === ANDROID)).toEqual([
        { token: ANDROID, userId: 'user-2', platform: PushPlatform.ANDROID },
      ]);
    });

    it('treats a token saved by a request at the same moment as existing', async () => {
      repo.update.mockResolvedValueOnce({ affected: 0 });
      repo.insert.mockRejectedValueOnce(
        Object.assign(new QueryFailedError('INSERT', [], new Error('dup')), {
          code: '23505',
        }),
      );

      await expect(
        service.saveToken('user-2', {
          token: ANDROID,
          platform: PushPlatform.ANDROID,
        }),
      ).resolves.toBe(false);
    });
  });

  describe('removeToken', () => {
    it("removes the user's own token", async () => {
      await service.removeToken('user-1', ANDROID);

      expect(tokens.map((t) => t.token)).toEqual([IPHONE]);
    });

    it("leaves another user's token alone", async () => {
      await service.removeToken('user-2', ANDROID);

      expect(tokens).toHaveLength(2);
    });

    it("doesn't fail for a token that's already gone", async () => {
      await expect(
        service.removeToken('user-1', 'ExponentPushToken[gone]'),
      ).resolves.toBeUndefined();
    });
  });

  describe('send', () => {
    it("pushes to every one of the user's phones", async () => {
      expo.sendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
        { status: 'ok', id: 'ticket-2' },
      ]);

      await service.send(['user-1', 'user-1'], message);

      expect(expo.sendPushNotificationsAsync).toHaveBeenCalledWith([
        expect.objectContaining({ to: ANDROID, ...message, sound: 'default' }),
        expect.objectContaining({ to: IPHONE, channelId: 'default' }),
      ]);
      expect(queue.add).toHaveBeenCalledWith(
        PUSH_RECEIPTS_JOB,
        {
          receipts: [
            { id: 'ticket-1', token: ANDROID },
            { id: 'ticket-2', token: IPHONE },
          ],
        },
        expect.objectContaining({ delay: 15 * 60 * 1000 }),
      );
    });

    it('shows the image on the notification when there is one', async () => {
      expo.sendPushNotificationsAsync.mockResolvedValue([]);

      await service.send(['user-1'], {
        ...message,
        image: 'https://cdn/a.png',
      });

      expect(expo.sendPushNotificationsAsync).toHaveBeenCalledWith([
        expect.objectContaining({
          richContent: { image: 'https://cdn/a.png' },
          mutableContent: true,
        }),
        expect.anything(),
      ]);
    });

    it('leaves richContent out when there is no image', async () => {
      expo.sendPushNotificationsAsync.mockResolvedValue([]);

      await service.send(['user-1'], { ...message, image: null });

      const [[sent]] = expo.sendPushNotificationsAsync.mock.calls as [
        Record<string, unknown>[],
      ][];
      expect(sent[0]).not.toHaveProperty('richContent');
      expect(sent[0]).not.toHaveProperty('mutableContent');
    });

    it('removes a token whose ticket says the app was uninstalled', async () => {
      expo.sendPushNotificationsAsync.mockResolvedValue([
        {
          status: 'error',
          message: 'not registered',
          details: { error: 'DeviceNotRegistered' },
        },
        { status: 'ok', id: 'ticket-2' },
      ]);
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await service.send(['user-1'], message);

      expect(tokens.map((t) => t.token)).toEqual([IPHONE]);
    });

    it('sends nothing to a user without phones', async () => {
      await service.send(['user-2'], message);

      expect(expo.sendPushNotificationsAsync).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it("doesn't throw when Expo fails", async () => {
      expo.sendPushNotificationsAsync.mockRejectedValue(new Error('down'));
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(service.send(['user-1'], message)).resolves.toBeUndefined();
    });
  });

  describe('checkReceipts', () => {
    it('removes tokens whose receipt says the app was uninstalled', async () => {
      expo.getPushNotificationReceiptsAsync.mockResolvedValue({
        'ticket-1': {
          status: 'error',
          message: 'not registered',
          details: { error: 'DeviceNotRegistered' },
        },
        'ticket-2': { status: 'ok' },
      });
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await service.checkReceipts([
        { id: 'ticket-1', token: ANDROID },
        { id: 'ticket-2', token: IPHONE },
      ]);

      expect(tokens.map((t) => t.token)).toEqual([IPHONE]);
    });

    it('keeps tokens for other receipt errors', async () => {
      expo.getPushNotificationReceiptsAsync.mockResolvedValue({
        'ticket-1': {
          status: 'error',
          message: 'rate limited',
          details: { error: 'MessageRateExceeded' },
        },
      });
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await service.checkReceipts([{ id: 'ticket-1', token: ANDROID }]);

      expect(tokens).toHaveLength(2);
    });
  });
});

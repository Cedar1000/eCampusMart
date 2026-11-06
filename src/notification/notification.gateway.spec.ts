import { Logger } from '@nestjs/common';

import { Notification } from './entities/notification.entity';
import { NotificationGateway } from './notification.gateway';

describe('NotificationGateway', () => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const redis = { mget: jest.fn() };
  const gateway = new NotificationGateway(redis as never);
  Object.assign(gateway, { server: { to } });

  const row = {
    id: 'n1',
    userId: 'user-1',
    title: 'New order',
  } as Notification;

  beforeEach(() => jest.clearAllMocks());

  it('sends the row as `notification` to its connected user', async () => {
    redis.mget.mockResolvedValue(['socket-1']);

    await gateway.notify(row);

    expect(redis.mget).toHaveBeenCalledWith('user-user-1');
    expect(emit).toHaveBeenCalledWith('notification', row);
  });

  it('sends nothing to a user who is offline', async () => {
    redis.mget.mockResolvedValue([null]);

    await gateway.notify(row);

    expect(emit).not.toHaveBeenCalled();
  });

  it("doesn't throw when Redis fails", async () => {
    redis.mget.mockRejectedValue(new Error('redis down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(gateway.notify(row)).resolves.toBeUndefined();
  });
});

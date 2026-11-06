import { NotificationType } from './entities/notification.entity';
import { Logger } from '@nestjs/common';

import {
  NotificationService,
  formatExpiresIn,
  formatNaira,
} from './notification.service';

describe('NotificationService.findAll', () => {
  const rows = [
    {
      id: 'notification-1',
      userId: 'user-1',
      type: NotificationType.OFFER_ACCEPTED,
      title: 'Offer accepted',
      body: '₦6,000 · Oraimo 20W fast charger · order ORD-2113 created',
      data: { offerId: 'offer-1', orderId: 'order-1' },
      isRead: false,
    },
  ];
  const repo = {
    find: jest.fn(() => rows),
    count: jest.fn(() => 1),
    insert: jest.fn(),
  };
  const service = new NotificationService(repo as never);

  beforeEach(() => jest.clearAllMocks());

  it("returns a page of the user's notifications, newest first", async () => {
    await expect(service.findAll({}, 'user-1')).resolves.toMatchObject({
      status: 'success',
      count: 1,
      data: rows,
    });

    const [options] = repo.find.mock.calls[0] as unknown as [
      { where: object[]; order: object },
    ];
    expect(options.where).toEqual([
      expect.objectContaining({ userId: 'user-1' }),
    ]);
    expect(options.order).toEqual({ createdAt: 'DESC', id: 'DESC' });
  });

  it("can't be pointed at another user's notifications from the query", async () => {
    await service.findAll({ userId: 'user-2' }, 'user-1');

    const [options] = repo.find.mock.calls[0] as unknown as [
      { where: { userId: string }[] },
    ];
    expect(options.where.every((clause) => clause.userId === 'user-1')).toBe(
      true,
    );
  });
});

describe('NotificationService.create', () => {
  const repo = { insert: jest.fn() };
  const service = new NotificationService(repo as never);
  const notification = {
    userId: 'user-1',
    type: NotificationType.WALLET_DEBITED,
    title: 'Wallet debited',
    body: '₦300 listing fee debited.',
  };

  beforeEach(() => jest.clearAllMocks());

  it('saves each notification unread, skipping any without a user', async () => {
    await service.create(notification, { ...notification, userId: '' });

    expect(repo.insert).toHaveBeenCalledWith([{ ...notification, data: null }]);
  });

  it("doesn't throw when saving fails", async () => {
    repo.insert.mockRejectedValue(new Error('db down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(service.create(notification)).resolves.toBeUndefined();
  });

  it('formats kobo as naira', () => {
    expect(formatNaira(600000)).toBe('₦6,000');
    expect(formatNaira('30000')).toBe('₦300');
  });
});

describe('formatExpiresIn', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');
  const inHours = (hours: number) =>
    formatExpiresIn(new Date(now.getTime() + hours * 60 * 60 * 1000), now);

  it.each([
    [24, 'expires in 24 hrs'],
    [23.5, 'expires in 24 hrs'],
    [1, 'expires in 1 hr'],
    [0.2, 'expires in 1 hr'],
    [47, 'expires in 47 hrs'],
    [48, 'expires in 2 days'],
    [72, 'expires in 3 days'],
  ])('%s hours out reads "%s"', (hours, text) => {
    expect(inHours(hours)).toBe(text);
  });

  it('never reads less than 1 hr, even once past', () => {
    expect(inHours(-2)).toBe('expires in 1 hr');
  });
});

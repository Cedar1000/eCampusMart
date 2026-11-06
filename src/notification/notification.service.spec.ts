import { NotificationType } from './entities/notification.entity';
import { Logger, NotFoundException } from '@nestjs/common';

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
      read: false,
    },
  ];
  const repo = {
    find: jest.fn(() => rows),
    count: jest.fn(() => 1),
  };
  const service = new NotificationService(repo as never, {} as never);

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
  const repo = {
    create: jest.fn((row: object) => row),
    save: jest.fn((rows: object[]): Promise<object[]> | object[] =>
      rows.map((row, i) => ({
        id: `notification-${i + 1}`,
        read: false,
        ...row,
      })),
    ),
  };
  const gateway = { notify: jest.fn() };
  const service = new NotificationService(repo as never, gateway as never);
  const notification = {
    userId: 'user-1',
    type: NotificationType.WALLET_DEBITED,
    title: 'Wallet debited',
    body: '₦300 listing fee debited.',
  };

  beforeEach(() => jest.clearAllMocks());

  it('saves each notification, skipping any without a user', async () => {
    await service.create(notification, { ...notification, userId: '' });

    expect(repo.save).toHaveBeenCalledWith([{ ...notification, data: null }]);
  });

  it('sends each saved row to its user over the socket', async () => {
    await service.create(notification, { ...notification, userId: 'user-2' });

    expect(gateway.notify.mock.calls).toEqual([
      [expect.objectContaining({ id: 'notification-1', userId: 'user-1' })],
      [expect.objectContaining({ id: 'notification-2', userId: 'user-2' })],
    ]);
  });

  it("doesn't throw when saving fails, and sends nothing", async () => {
    repo.save.mockRejectedValueOnce(new Error('db down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(service.create(notification)).resolves.toBeUndefined();
    expect(gateway.notify).not.toHaveBeenCalled();
  });

  it('formats kobo as naira', () => {
    expect(formatNaira(600000)).toBe('₦6,000');
    expect(formatNaira('30000')).toBe('₦300');
  });
});

describe('NotificationService read', () => {
  let rows: { id: string; userId: string; read: boolean }[];
  const repo = {
    exists: jest.fn(({ where }: { where: { id: string; userId: string } }) =>
      rows.some((r) => r.id === where.id && r.userId === where.userId),
    ),
    findOneBy: jest.fn(({ id }: { id: string }) =>
      rows.find((r) => r.id === id),
    ),
    save: jest.fn((row: { id: string; read: boolean }) => {
      Object.assign(
        rows.find((r) => r.id === row.id)!,
        row,
      );
      return row;
    }),
    update: jest.fn(
      (where: { userId: string; read: boolean }, values: { read: boolean }) => {
        const matched = rows.filter(
          (r) => r.userId === where.userId && r.read === where.read,
        );
        matched.forEach((r) => Object.assign(r, values));
        return { affected: matched.length };
      },
    ),
  };
  const service = new NotificationService(repo as never, {} as never);

  beforeEach(() => {
    rows = [
      { id: 'n1', userId: 'user-1', read: false },
      { id: 'n2', userId: 'user-1', read: false },
      { id: 'n3', userId: 'user-2', read: false },
    ];
  });

  it("marks one of the user's notifications read", async () => {
    const result = await service.markRead('n1', 'user-1');

    expect(result.data).toMatchObject({ id: 'n1', read: true });
    expect(rows.map((r) => r.read)).toEqual([true, false, false]);
  });

  it("returns 404 for someone else's notification", async () => {
    await expect(service.markRead('n3', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(rows[2].read).toBe(false);
  });

  it("marks all the user's notifications read, and only theirs", async () => {
    const result = await service.markAllRead('user-1');

    expect(result.data).toEqual({ updated: 2 });
    expect(rows.map((r) => r.read)).toEqual([true, true, false]);
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

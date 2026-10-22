import { BadRequestException, ConflictException } from '@nestjs/common';
import * as paystack from 'utils/paystack';
import sendEmail from 'utils/sendEmail';
import { User } from 'src/auth/entities/user.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { SubscriptionService } from './subscription.service';

jest.mock('utils/paystack');
jest.mock('utils/sendEmail');

const DAY = 24 * 60 * 60 * 1000;

const user = {
  id: 'owner-1',
  email: 'ada@example.com',
  firstName: 'Ada',
} as User;

// The email isn't awaited by the request
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('SubscriptionService.startFreeTrial', () => {
  let service: SubscriptionService;
  let store: Partial<ServiceStore>;
  let onPlan: boolean;
  let failSave: boolean;
  let manager: { update: jest.Mock; findOne: jest.Mock; exists: jest.Mock };

  const start = () => service.startFreeTrial({ storeId: 'store-1' }, user);

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(sendEmail).mockReset();

    // A new store: created off Explore with no free plan yet
    const createdAt = new Date(Date.now() - DAY);
    store = {
      id: 'store-1',
      name: 'Ada Cuts',
      ownerId: 'owner-1',
      createdAt,
      trialEndsAt: createdAt,
      trialCancelled: false,
      hasFreeTrial: true,
      trialReminderSent: '1d',
    };
    onPlan = false;
    failSave = false;

    const storeRepo = {
      findOneBy: jest.fn(() => ({ ...store })),
      update: jest.fn((_id: string, changes: object) =>
        Object.assign(store, changes),
      ),
      // The conditional claim: only changes a store that still has its free plan
      createQueryBuilder: () => {
        const builder = {
          update: () => builder,
          set: () => builder,
          where: () => builder,
          execute: () => {
            if (!store.hasFreeTrial) return { affected: 0 };
            store.hasFreeTrial = false;
            return { affected: 1 };
          },
        };
        return builder;
      },
    };

    manager = {
      update: jest.fn((entity: unknown, _id: unknown, changes: object) => {
        if (failSave) throw new Error('database down');
        if (entity === ServiceStore) Object.assign(store, changes);
      }),
      findOne: jest.fn(() => ({ ...store })),
      exists: jest.fn(() => false),
    };

    service = new SubscriptionService(
      storeRepo as never,
      { exists: jest.fn(() => onPlan) } as never,
      {} as never,
      { get: jest.fn() } as never,
      {
        transaction: jest.fn((run: (m: typeof manager) => unknown) =>
          run(manager),
        ),
      } as never,
    );
  });

  it('puts the store on a free plan and on Explore, with no card', async () => {
    const { data } = await start();

    expect(Math.round((data.trialEndsAt.getTime() - Date.now()) / DAY)).toBe(
      30,
    );
    expect(store).toMatchObject({
      hasFreeTrial: false,
      trialEndsAt: data.trialEndsAt,
      trialCancelled: false,
      trialReminderSent: null,
    });
    // syncStoreVisibility lists the store and its services
    expect(manager.update).toHaveBeenCalledWith(ServiceStore, 'store-1', {
      hasActiveSubscription: true,
    });
    // No card, so nothing goes to Paystack
    expect(paystack.verifyPaystackTransaction).not.toHaveBeenCalled();
    expect(paystack.createPaystackSubscription).not.toHaveBeenCalled();
    expect(paystack.refundPaystackTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['already used its free plan', () => (store.hasFreeTrial = false)],
    ['is on a plan', () => (onPlan = true)],
    [
      'is already in its free plan',
      () => (store.trialEndsAt = new Date(Date.now() + 5 * DAY)),
    ],
  ])('refuses a store that %s', async (_case, arrange) => {
    arrange();

    await expect(start()).rejects.toThrow(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('starts only one free plan when two requests race', async () => {
    const results = await Promise.allSettled([start(), start()]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')?.reason).toBeInstanceOf(
      ConflictException,
    );
  });

  it('gives the free plan back when saving fails', async () => {
    failSave = true;

    await expect(start()).rejects.toThrow('database down');
    expect(store.hasFreeTrial).toBe(true);

    await flush();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('emails the owner that the free plan started', async () => {
    await start();
    await flush();

    const [email] = jest.mocked(sendEmail).mock.calls[0];

    expect(email).toMatchObject({
      to: 'ada@example.com',
      subject: 'Your free plan has started',
    });
    expect(email.text).toContain('Dear Ada');
    expect(email.text).toContain('Ada Cuts');
    expect(email.text).toContain('Subscribe to a plan');
  });

  it('still starts the free plan when the email fails', async () => {
    jest.mocked(sendEmail).mockRejectedValue(new Error('smtp down'));

    await expect(start()).resolves.toMatchObject({ status: 'success' });
    await flush();
  });
});

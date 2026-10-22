import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  createPaystackSubscription,
  disablePaystackSubscription,
  refundPaystackTransaction,
  verifyPaystackTransaction,
} from 'utils/paystack';
import sendEmail from 'utils/sendEmail';
import { User } from 'src/auth/entities/user.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { TRIAL_CARD_CHECK_AMOUNT } from './subscription.constants';
import { SubscriptionService } from './subscription.service';

jest.mock('utils/paystack');
jest.mock('utils/sendEmail');

const DAY = 24 * 60 * 60 * 1000;

const user = {
  id: 'owner-1',
  email: 'Ada@Example.com',
  firstName: 'Ada',
} as User;

// The email isn't awaited by the request
const flush = () => new Promise((resolve) => setImmediate(resolve));

const paidCardCheck = () => ({
  status: 'success',
  amount: TRIAL_CARD_CHECK_AMOUNT,
  currency: 'NGN',
  customer: { email: 'ada@example.com', customer_code: 'CUS_1' },
  authorization: {
    authorization_code: 'AUTH_1',
    reusable: true,
    last4: '4081',
    exp_month: '12',
    exp_year: '2030',
    card_type: 'visa',
    bank: 'Test Bank',
    signature: 'SIG_1',
  },
});

describe('SubscriptionService.startFreeTrial', () => {
  let service: SubscriptionService;
  let store: Partial<ServiceStore>;
  let saved: Partial<Subscription>[];
  let usedReferences: string[];
  let existing: { isTrial?: boolean; paid?: boolean };
  let failSave: boolean;

  const start = (reference = 'ref-1') =>
    service.startFreeTrial(
      { reference, storeId: 'store-1', plan: 'monthly' } as never,
      user,
    );

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(verifyPaystackTransaction).mockReset();
    jest.mocked(verifyPaystackTransaction).mockResolvedValue(paidCardCheck());
    jest.mocked(createPaystackSubscription).mockReset();
    jest.mocked(createPaystackSubscription).mockResolvedValue({
      subscription_code: 'SUB_1',
      email_token: 'TOKEN_1',
    });
    jest.mocked(disablePaystackSubscription).mockReset();
    jest.mocked(refundPaystackTransaction).mockReset();
    jest.mocked(sendEmail).mockReset();

    // A store whose old automatic free month has ended and never had a trial
    store = {
      id: 'store-1',
      name: 'Ada Cuts',
      ownerId: 'owner-1',
      createdAt: new Date(Date.now() - 40 * DAY),
      trialEndsAt: new Date(Date.now() - 10 * DAY),
      trialCancelled: false,
      hasFreeTrial: true,
    };
    saved = [];
    usedReferences = [];
    existing = {};
    failSave = false;

    const storeRepo = {
      findOneBy: jest.fn(() => ({ ...store })),
      update: jest.fn((_id: string, changes: object) =>
        Object.assign(store, changes),
      ),
      // The conditional claim: only changes a store that still has its trial
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

    const subscriptionRepo = {
      exists: jest.fn(
        ({ where }: { where: Record<string, unknown> }) =>
          (where.isTrial && existing.isTrial) ||
          (where.status && existing.paid) ||
          (typeof where.reference === 'string' &&
            usedReferences.includes(where.reference)),
      ),
    };

    const manager = {
      create: jest.fn((_entity: unknown, row: object) => row),
      save: jest.fn((row: Partial<Subscription>) => {
        if (failSave) throw new Error('database down');
        saved.push(row);
        return { id: 'sub-1', ...row };
      }),
      update: jest.fn((entity: unknown, _where: unknown, changes: object) => {
        if (entity === ServiceStore) Object.assign(store, changes);
      }),
      findOne: jest.fn(() => ({ ...store })),
      exists: jest.fn(() => saved.length > 0),
    };

    service = new SubscriptionService(
      storeRepo as never,
      subscriptionRepo as never,
      {
        findOneBy: jest.fn(() => ({
          id: 'plan-1',
          name: 'Monthly',
          type: 'monthly',
          amount: 5000,
          paystackId: 'PLN_1',
        })),
      } as never,
      { get: jest.fn() } as never,
      {
        transaction: jest.fn((run: (m: typeof manager) => unknown) =>
          run(manager),
        ),
      } as never,
      { exists: jest.fn(() => false) } as never,
    );
  });

  it('starts a trial that bills the plan when it ends, and keeps the card', async () => {
    const { data } = await start();

    const startDate = new Date(
      jest.mocked(createPaystackSubscription).mock.calls[0][0].start_date,
    );

    expect(createPaystackSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'CUS_1',
        plan: 'PLN_1',
        authorization: 'AUTH_1',
      }),
    );
    expect(Math.round((startDate.getTime() - Date.now()) / DAY)).toBe(30);

    expect(saved[0]).toMatchObject({
      storeId: 'store-1',
      status: SubscriptionStatus.ACTIVE,
      isTrial: true,
      subscriptionCode: 'SUB_1',
      emailToken: 'TOKEN_1',
      reference: 'ref-1',
      authorization: {
        authorizationCode: 'AUTH_1',
        customerCode: 'CUS_1',
        last4: '4081',
        reusable: true,
      },
    });
    expect(store).toMatchObject({
      hasFreeTrial: false,
      trialEndsAt: startDate,
    });
    expect(refundPaystackTransaction).toHaveBeenCalledWith('ref-1');

    // The card is never sent back
    expect(data.subscription).not.toHaveProperty('authorization');
  });

  it.each([
    ['the store already used its trial', () => (store.hasFreeTrial = false)],
    ['the store had a trial subscription', () => (existing.isTrial = true)],
    ['the store is on a plan', () => (existing.paid = true)],
    [
      'the store is in its old free month',
      () => (store.trialEndsAt = new Date(Date.now() + 5 * DAY)),
    ],
    ['the reference was used before', () => usedReferences.push('ref-1')],
  ])('refuses when %s', async (_case, arrange) => {
    arrange();

    await expect(start()).rejects.toThrow(BadRequestException);
    expect(verifyPaystackTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['the payment failed', { status: 'failed' }],
    ['the amount is wrong', { amount: 100 }],
    ['the currency is wrong', { currency: 'USD' }],
    [
      'someone else paid',
      { customer: { email: 'eve@example.com', customer_code: 'CUS_2' } },
    ],
    [
      'the card cannot be charged again',
      { authorization: { authorization_code: 'AUTH_1', reusable: false } },
    ],
  ])('refuses when %s', async (_case, change) => {
    jest
      .mocked(verifyPaystackTransaction)
      .mockResolvedValue({ ...paidCardCheck(), ...change });

    await expect(start()).rejects.toThrow(BadRequestException);
    expect(createPaystackSubscription).not.toHaveBeenCalled();
    expect(store.hasFreeTrial).toBe(true);
  });

  it('answers 502 when Paystack cannot be reached', async () => {
    jest.mocked(verifyPaystackTransaction).mockRejectedValue(new Error('down'));

    await expect(start()).rejects.toThrow(BadGatewayException);
  });

  it('starts only one trial when two requests race', async () => {
    const results = await Promise.allSettled([start('ref-1'), start('ref-2')]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')?.reason).toBeInstanceOf(
      ConflictException,
    );
    expect(createPaystackSubscription).toHaveBeenCalledTimes(1);
  });

  it('gives the trial back when Paystack cannot create the subscription', async () => {
    jest
      .mocked(createPaystackSubscription)
      .mockRejectedValue(new Error('down'));

    await expect(start()).rejects.toThrow(BadGatewayException);
    expect(store.hasFreeTrial).toBe(true);
  });

  it('cancels the Paystack subscription and gives the trial back when saving fails', async () => {
    failSave = true;

    await expect(start()).rejects.toThrow('database down');
    expect(disablePaystackSubscription).toHaveBeenCalledWith(
      'SUB_1',
      'TOKEN_1',
    );
    expect(store.hasFreeTrial).toBe(true);
    expect(refundPaystackTransaction).not.toHaveBeenCalled();
  });

  it('still starts the trial when the refund fails', async () => {
    jest.mocked(refundPaystackTransaction).mockRejectedValue(new Error('down'));

    await expect(start()).resolves.toMatchObject({ status: 'success' });
    await flush();

    expect(jest.mocked(sendEmail).mock.calls[0][0].text).toContain(
      'will be refunded shortly',
    );
  });

  it('emails the user that the trial started', async () => {
    await start();
    await flush();

    expect(sendEmail).toHaveBeenCalledTimes(1);

    const [email] = jest.mocked(sendEmail).mock.calls[0];

    expect(email).toMatchObject({
      to: 'Ada@Example.com',
      subject: 'Your free trial has started',
    });
    expect(email.text).toContain('Dear Ada');
    expect(email.text).toContain('Ada Cuts');
    expect(email.text).toContain('Monthly plan');
    expect(email.text).toContain('ending in 4081');
    expect(email.text).toContain('NGN 5,000');
    expect(email.text).toContain('has been refunded');
  });

  it('still starts the trial when the email fails', async () => {
    jest.mocked(sendEmail).mockRejectedValue(new Error('smtp down'));

    await expect(start()).resolves.toMatchObject({ status: 'success' });
    await flush();
  });

  it("doesn't email when the trial didn't start", async () => {
    failSave = true;

    await expect(start()).rejects.toThrow();
    await flush();

    expect(sendEmail).not.toHaveBeenCalled();
  });
});

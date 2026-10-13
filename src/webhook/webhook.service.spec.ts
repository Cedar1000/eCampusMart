import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { DataSource } from 'typeorm';
import sendEmail from 'utils/sendEmail';
import { User } from 'src/auth/entities/user.entity';
import { Service } from 'src/service/entities/service.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import { Transaction } from 'src/transaction/entities/transaction.entity';
import { SubscriptionWebhookService } from './subscription-webhook.service';
import { WalletWebhookService } from './wallet-webhook.service';
import { WebhookService } from './webhook.service';

jest.mock('utils/sendEmail');

const SECRET = 'sk_test';

// Emails go out after the webhook is acknowledged
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('WebhookService', () => {
  let service: WebhookService;
  let subscription: Partial<Subscription>;
  let rows: Partial<Subscription>[];
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    exists: jest.Mock;
    update: jest.Mock;
  };

  const send = (event: string, data: Record<string, unknown>) => {
    const rawBody = Buffer.from(JSON.stringify({ event, data }));

    return service.handlePaystackWebhook({
      signature: createHmac('sha512', SECRET).update(rawBody).digest('hex'),
      payload: { event, data },
      rawBody,
    });
  };

  beforeEach(async () => {
    subscription = {
      storeId: 'store-1',
      userId: 'user-1',
      amount: 500000,
      status: SubscriptionStatus.PENDING,
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    jest.mocked(sendEmail).mockReset();
    rows = [subscription];

    manager = {
      findOne: jest.fn((entity: unknown) =>
        entity === Subscription ? subscription : { id: 'user-1' },
      ),
      create: jest.fn((_entity: unknown, row: Partial<Subscription>) => row),
      save: jest.fn((row: Partial<Subscription>) => {
        if (!rows.includes(row)) rows.push(row);
        return row;
      }),
      exists: jest.fn(
        (
          _entity: unknown,
          {
            where,
          }: { where: { reference?: string; status?: { value: string[] } } },
        ) =>
          rows.some((row) =>
            where.reference
              ? row.reference === where.reference
              : where.status?.value.includes(row.status as string),
          ),
      ),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        WalletWebhookService,
        SubscriptionWebhookService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: { findOne: jest.fn(() => subscription), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(() => ({ email: 'a@b.com', firstName: 'Ada' })),
          },
        },
        {
          provide: getRepositoryToken(ServiceStore),
          useValue: { findOne: jest.fn(() => ({ name: 'Ada Cuts' })) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => SECRET) },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((run: (m: typeof manager) => unknown) =>
              run(manager),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('activates a subscription on its first charge', async () => {
    await send('charge.success', {
      reference: 'ref-1',
      metadata: { description: 'store-subscription' },
    });

    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(manager.update).toHaveBeenCalledWith(ServiceStore, 'store-1', {
      hasActiveSubscription: true,
    });
    expect(manager.update).toHaveBeenCalledWith(
      Service,
      { storeId: 'store-1' },
      { isActive: true },
    );
  });

  it('ignores renewal charges, which carry a plan but no metadata', async () => {
    manager.findOne.mockReturnValue(null);

    await send('charge.success', {
      reference: 'ref-2',
      plan: { plan_code: 'PLN_1' },
    });

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('links the Paystack subscription on subscription.create', async () => {
    manager.findOne.mockImplementation(
      (entity: unknown, options: { where: Record<string, unknown> }) => {
        if (entity !== Subscription) return { id: 'user-1' };
        return typeof options.where.subscriptionCode === 'string'
          ? null
          : subscription;
      },
    );

    await send('subscription.create', {
      subscription_code: 'SUB_1',
      email_token: 'token',
      next_payment_date: '2026-11-13T00:00:00.000Z',
      plan: { plan_code: 'PLN_1' },
      customer: { email: 'a@b.com' },
    });

    expect(subscription).toMatchObject({
      status: SubscriptionStatus.ACTIVE,
      subscriptionCode: 'SUB_1',
      emailToken: 'token',
      expiresAt: new Date('2026-11-13T00:00:00.000Z'),
    });
  });

  describe('paid invoice.update', () => {
    const renewal = {
      paid: true,
      subscription: {
        subscription_code: 'SUB_1',
        next_payment_date: '2026-12-13T00:00:00.000Z',
      },
      transaction: { reference: 'renewal-ref' },
    };

    beforeEach(() => {
      Object.assign(subscription, {
        userId: 'user-1',
        planId: 'plan-1',
        paystackId: 'PLN_1',
        amount: 5000,
        reference: 'ref-1',
        subscriptionCode: 'SUB_1',
        emailToken: 'token',
        status: SubscriptionStatus.ACTIVE,
      });
    });

    it('expires the previous subscription and creates the next one', async () => {
      await send('invoice.update', renewal);

      expect(subscription.status).toBe(SubscriptionStatus.EXPIRED);
      expect(rows).toHaveLength(2);
      expect(rows[1]).toEqual({
        userId: 'user-1',
        planId: 'plan-1',
        storeId: 'store-1',
        paystackId: 'PLN_1',
        amount: 5000,
        subscriptionCode: 'SUB_1',
        emailToken: 'token',
        reference: 'renewal-ref',
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date('2026-12-13T00:00:00.000Z'),
      });
      expect(manager.update).toHaveBeenCalledWith(ServiceStore, 'store-1', {
        hasActiveSubscription: true,
      });
      expect(manager.update).toHaveBeenCalledWith(
        Service,
        { storeId: 'store-1' },
        { isActive: true },
      );
    });

    it('does not renew twice when Paystack redelivers the invoice', async () => {
      await send('invoice.update', renewal);
      manager.findOne.mockImplementation(() => rows[1]);
      await send('invoice.update', renewal);

      expect(rows).toHaveLength(2);
      expect(rows[1].status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  it('deactivates the store when a renewal fails', async () => {
    subscription.status = SubscriptionStatus.ACTIVE;

    await send('invoice.payment_failed', {
      subscription: { subscription_code: 'SUB_1' },
    });

    expect(subscription.status).toBe(SubscriptionStatus.INACTIVE);
    expect(manager.update).toHaveBeenCalledWith(ServiceStore, 'store-1', {
      hasActiveSubscription: false,
    });
    expect(manager.update).toHaveBeenCalledWith(
      Service,
      { storeId: 'store-1' },
      { isActive: false },
    );
  });

  it('keeps the store active while a subscription is not renewing', async () => {
    await send('subscription.not_renew', { subscription_code: 'SUB_1' });

    expect(subscription.status).toBe(SubscriptionStatus.NON_RENEWING);
    expect(manager.update).toHaveBeenCalledWith(ServiceStore, 'store-1', {
      hasActiveSubscription: true,
    });
    expect(manager.update).toHaveBeenCalledWith(
      Service,
      { storeId: 'store-1' },
      { isActive: true },
    );
  });

  it.each([
    ['complete', SubscriptionStatus.EXPIRED],
    ['cancelled', SubscriptionStatus.CANCELLED],
  ])(
    'ends the subscription on subscription.disable (%s)',
    async (status, expected) => {
      await send('subscription.disable', {
        subscription_code: 'SUB_1',
        status,
      });

      expect(subscription.status).toBe(expected);
      expect(manager.update).toHaveBeenCalledWith(ServiceStore, 'store-1', {
        hasActiveSubscription: false,
      });
      expect(manager.update).toHaveBeenCalledWith(
        Service,
        { storeId: 'store-1' },
        { isActive: false },
      );
    },
  );

  it('sends a reminder on invoice.create without changing anything', async () => {
    await send('invoice.create', {
      subscription: { subscription_code: 'SUB_1' },
    });
    await flush();

    expect(manager.save).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Subscription renewal invoice' }),
    );
  });

  it('emails the user once an event has been processed', async () => {
    await send('subscription.not_renew', { subscription_code: 'SUB_1' });
    await flush();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'a@b.com',
      subject: 'Subscription will not renew',
      text: expect.stringContaining(
        'Dear Ada, Your subscription for Ada Cuts',
      ) as string,
    });
  });

  it('does not email again when Paystack redelivers an event', async () => {
    await send('subscription.not_renew', { subscription_code: 'SUB_1' });
    await send('subscription.not_renew', { subscription_code: 'SUB_1' });
    await flush();

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('still acknowledges the webhook when the email fails', async () => {
    jest.mocked(sendEmail).mockRejectedValue(new Error('smtp down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      send('subscription.not_renew', { subscription_code: 'SUB_1' }),
    ).resolves.toEqual({ status: true, message: 'Webhook processed' });
    await flush();
  });
});

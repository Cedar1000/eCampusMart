import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { verifyPaystackTransaction } from 'utils/paystack';

import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import {
  Transaction,
  TransactionDescription,
  TransactionStatus,
} from 'src/transaction/entities/transaction.entity';
import { PaymentService } from './payment.service';
import { SubscriptionWebhookService } from './subscription-webhook.service';
import { WalletWebhookService } from './wallet-webhook.service';

jest.mock('utils/paystack');

const USER = 'user-1';

describe('PaymentService.verify', () => {
  let transaction: Partial<Transaction> | null;
  let subscription: Partial<Subscription> | null;
  let balance: number;
  let service: PaymentService;

  const walletWebhook = { handle: jest.fn() };
  const subscriptionWebhook = { handle: jest.fn() };

  beforeEach(() => {
    jest.mocked(verifyPaystackTransaction).mockReset();
    jest.clearAllMocks();

    balance = 0;
    subscription = null;
    transaction = {
      reference: 'ref-1',
      description: TransactionDescription.FUND,
      amount: 1000000,
      currency: 'NGN',
      status: TransactionStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      wallet: { userId: USER } as Transaction['wallet'],
    };

    // Crediting the wallet, as the real settlement would
    walletWebhook.handle.mockImplementation((event: string) => {
      if (event === 'charge.success' && transaction) {
        transaction.status = TransactionStatus.SUCCESS;
        balance += 1000000;
      }
      if (event === 'charge.failed' && transaction) {
        transaction.status = TransactionStatus.FAILED;
      }
    });

    service = new PaymentService(
      { findOne: jest.fn(() => transaction) } as never,
      { findOne: jest.fn(() => ({ balance: String(balance) })) } as never,
      { findOne: jest.fn(() => subscription) } as never,
      walletWebhook as unknown as WalletWebhookService,
      subscriptionWebhook as unknown as SubscriptionWebhookService,
    );
  });

  it('credits a pending top-up that Paystack says was paid', async () => {
    jest
      .mocked(verifyPaystackTransaction)
      .mockResolvedValue({ status: 'success', amount: 1000000 });

    await expect(service.verify('ref-1', USER)).resolves.toEqual({
      status: 'success',
      data: {
        reference: 'ref-1',
        purpose: 'fund',
        status: 'success',
        amount: 10000,
        balance: 10000,
      },
    });
    expect(walletWebhook.handle).toHaveBeenCalledWith(
      'charge.success',
      expect.objectContaining({ reference: 'ref-1', amount: 1000000 }),
    );
  });

  it("doesn't call Paystack for a settled payment", async () => {
    transaction!.status = TransactionStatus.SUCCESS;

    const { data } = await service.verify('ref-1', USER);

    expect(data.status).toBe('success');
    expect(verifyPaystackTransaction).not.toHaveBeenCalled();
  });

  it.each(['failed', 'reversed'])(
    'marks a %s payment failed',
    async (status) => {
      jest.mocked(verifyPaystackTransaction).mockResolvedValue({ status });

      const { data } = await service.verify('ref-1', USER);

      expect(data.status).toBe('failed');
    },
  );

  it('leaves an abandoned checkout pending until it expires', async () => {
    jest
      .mocked(verifyPaystackTransaction)
      .mockResolvedValue({ status: 'abandoned' });

    expect((await service.verify('ref-1', USER)).data.status).toBe('pending');

    transaction!.expiresAt = new Date(Date.now() - 1000);

    expect((await service.verify('ref-1', USER)).data.status).toBe('failed');
  });

  it("refuses someone else's payment", async () => {
    await expect(service.verify('ref-1', 'user-2')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it.each([
    TransactionDescription.PRODUCT_UPLOAD,
    TransactionDescription.HOUSING_UPLOAD,
  ])(
    'refuses a %s transaction, which never went through Paystack',
    async (description) => {
      Object.assign(transaction!, {
        description,
        status: TransactionStatus.SUCCESS,
      });

      await expect(service.verify('ref-1', USER)).rejects.toThrow(
        `Only wallet top-ups can be verified; this is a ${description} transaction`,
      );
      expect(verifyPaystackTransaction).not.toHaveBeenCalled();
    },
  );

  it('returns 404 for an unknown reference', async () => {
    transaction = null;

    await expect(service.verify('nope', USER)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('activates a subscription through the subscription settlement', async () => {
    transaction = null;
    subscription = {
      reference: 'ref-1',
      userId: USER,
      amount: 500000,
      status: SubscriptionStatus.PENDING,
    };
    subscriptionWebhook.handle.mockImplementation(() => {
      subscription!.status = SubscriptionStatus.ACTIVE;
    });
    jest
      .mocked(verifyPaystackTransaction)
      .mockResolvedValue({ status: 'success', amount: 500000 });

    const { data } = await service.verify('ref-1', USER);

    expect(data).toMatchObject({
      purpose: 'subscription',
      status: 'success',
      amount: 5000,
    });
    expect(subscriptionWebhook.handle).toHaveBeenCalledWith(
      'charge.success',
      expect.objectContaining({ reference: 'ref-1' }),
    );
  });

  describe('a store checkout replaced by a newer one', () => {
    beforeEach(() => {
      transaction = null;
      subscription = {
        reference: 'ref-1',
        userId: USER,
        amount: 90000,
        status: SubscriptionStatus.EXPIRED,
        subscriptionCode: undefined,
      };
    });

    it('asks Paystack, and reports it paid once the webhook code activates it', async () => {
      jest
        .mocked(verifyPaystackTransaction)
        .mockResolvedValue({ status: 'success', amount: 90000 });
      subscriptionWebhook.handle.mockImplementation(() => {
        subscription!.status = SubscriptionStatus.ACTIVE;
      });

      const result = await service.verify('ref-1', USER);

      expect(subscriptionWebhook.handle).toHaveBeenCalledWith(
        'charge.success',
        expect.objectContaining({ reference: 'ref-1' }),
      );
      expect(result.data.status).toBe('success');
    });

    it('reports it failed when it was never paid', async () => {
      jest
        .mocked(verifyPaystackTransaction)
        .mockResolvedValue({ status: 'abandoned', amount: 90000 });

      const result = await service.verify('ref-1', USER);

      expect(result.data.status).toBe('failed');
    });
  });
});

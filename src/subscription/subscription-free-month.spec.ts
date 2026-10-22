import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { disablePaystackSubscription } from 'utils/paystack';
import { Service } from 'src/service/entities/service.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { SubscriptionService } from './subscription.service';

jest.mock('axios');
jest.mock('utils/paystack');

const DAY = 24 * 60 * 60 * 1000;

describe('SubscriptionService free month', () => {
  let service: SubscriptionService;
  let store: Partial<ServiceStore>;
  let subscriptionRepo: {
    findOne: jest.Mock;
    exists: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let manager: {
    findOne: jest.Mock;
    exists: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    store = {
      id: 'store-1',
      ownerId: 'owner-1',
      createdAt: new Date(Date.now() - 5 * DAY),
      trialEndsAt: null,
      trialCancelled: false,
    };

    subscriptionRepo = {
      findOne: jest.fn(() => null),
      exists: jest.fn(() => false),
      update: jest.fn(),
      save: jest.fn((row: unknown) => row),
      create: jest.fn((row: unknown) => row),
    };

    // The store row as the transaction sees it, after the service's own updates
    manager = {
      findOne: jest.fn(() => ({ ...store })),
      exists: jest.fn(() => false),
      update: jest.fn((entity: unknown, _where: unknown, changes: object) => {
        if (entity === ServiceStore) Object.assign(store, changes);
      }),
      save: jest.fn(),
    };

    jest.mocked(disablePaystackSubscription).mockReset();

    service = new SubscriptionService(
      { findOneBy: jest.fn(() => ({ ...store })) } as never,
      subscriptionRepo as never,
      {
        findOneBy: jest.fn(() => ({
          id: 'plan-1',
          type: 'monthly',
          amount: 5000,
          paystackId: 'PLN_1',
        })),
      } as never,
      { get: jest.fn(() => 'sk_test') } as never,
      {
        transaction: jest.fn((run: (m: typeof manager) => unknown) =>
          run(manager),
        ),
      } as never,
    );
  });

  it('cancels the free month, taking the store off Explore', async () => {
    await service.cancelSubscription('store-1', 'owner-1');

    expect(store.trialCancelled).toBe(true);
    expect(store.hasActiveSubscription).toBe(false);
    expect(manager.update).toHaveBeenCalledWith(
      Service,
      { storeId: 'store-1' },
      { isActive: false },
    );
    expect(disablePaystackSubscription).not.toHaveBeenCalled();
  });

  it('cancels a paid plan on Paystack too', async () => {
    const plan = {
      status: SubscriptionStatus.ACTIVE,
      subscriptionCode: 'SUB_1',
      emailToken: 'TOKEN_1',
    };
    subscriptionRepo.findOne.mockReturnValue(plan);

    await service.cancelSubscription('store-1', 'owner-1');

    expect(disablePaystackSubscription).toHaveBeenCalledWith(
      'SUB_1',
      'TOKEN_1',
    );
    expect(plan.status).toBe(SubscriptionStatus.CANCELLED);
    expect(store.trialCancelled).toBe(true);
  });

  it('has nothing to cancel once the free month is over and there is no plan', async () => {
    store.createdAt = new Date(Date.now() - 40 * DAY);

    await expect(
      service.cancelSubscription('store-1', 'owner-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('restarts a cancelled free month until its original end', async () => {
    store.trialCancelled = true;

    const result = await service.restartFreeMonth('store-1', 'owner-1');

    expect(store.trialCancelled).toBe(false);
    expect(store.hasActiveSubscription).toBe(true);
    expect(
      Math.round((result.data.trialEndsAt.getTime() - Date.now()) / DAY),
    ).toBe(25);
  });

  it("can't restart a free month that has ended", async () => {
    Object.assign(store, {
      trialCancelled: true,
      createdAt: new Date(Date.now() - 40 * DAY),
    });

    await expect(
      service.restartFreeMonth('store-1', 'owner-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it("can't restart a free month that is still running", async () => {
    await expect(
      service.restartFreeMonth('store-1', 'owner-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it("only lets the store's owner cancel or restart", async () => {
    await expect(
      service.cancelSubscription('store-1', 'someone-else'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.restartFreeMonth('store-1', 'someone-else'),
    ).rejects.toThrow(BadRequestException);
  });

  describe('checkout', () => {
    beforeEach(() => {
      jest.mocked(axios).post.mockResolvedValue({
        data: { status: true, message: 'ok', data: {} },
      });
    });

    const checkout = () =>
      service.initializeTransaction(
        {
          storeId: 'store-1',
          plan: 'monthly',
          userId: 'owner-1',
          email: 'a@b.com',
        } as never,
        'owner-1',
      );

    it('expires older unpaid checkouts for the store', async () => {
      await checkout();

      expect(subscriptionRepo.update).toHaveBeenCalledWith(
        { storeId: 'store-1', status: SubscriptionStatus.PENDING },
        { status: SubscriptionStatus.EXPIRED },
      );
    });

    it('bills straight away during the free plan; the webhook ends the free plan once paid', async () => {
      await checkout();

      const [row] = subscriptionRepo.create.mock.calls[0] as [
        { isTrial: boolean; expiresAt: Date },
      ];

      expect(row.isTrial).toBe(false);
      expect(Math.round((row.expiresAt.getTime() - Date.now()) / DAY)).toBe(30);
      // Nothing changes until it's paid, so an abandoned checkout keeps the free plan
      expect(store.trialCancelled).toBe(false);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('refuses a store already on a paid plan', async () => {
      subscriptionRepo.findOne.mockReturnValue({
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 20 * DAY),
      });

      await expect(checkout()).rejects.toThrow('use the change plan endpoint');
    });

    it('bills straight away once the free month is over', async () => {
      store.createdAt = new Date(Date.now() - 40 * DAY);

      await checkout();

      const [row] = subscriptionRepo.create.mock.calls[0] as [
        { isTrial: boolean; expiresAt: Date },
      ];

      expect(row.isTrial).toBe(false);
      expect(Math.round((row.expiresAt.getTime() - Date.now()) / DAY)).toBe(30);
    });
  });
});

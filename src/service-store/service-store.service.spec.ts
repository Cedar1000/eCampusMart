import { NotFoundException } from '@nestjs/common';
import { ListingCleanupService } from 'src/common/listing-cleanup/listing-cleanup.service';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import { SubscriptionPlan } from 'src/subscription-plan/entities/subscription-plan.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceStore } from './entities/service-store.entity';
import { ServiceStoreService } from './service-store.service';

const DAY = 24 * 60 * 60 * 1000;

describe('ServiceStoreService', () => {
  let service: ServiceStoreService;
  let storeRepo: {
    find: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let subscriptionRepo: { findOne: jest.Mock };

  const store = (fields: Partial<ServiceStore> = {}) =>
    ({
      id: 'store-1',
      ownerId: 'owner-1',
      createdAt: new Date(),
      trialEndsAt: null,
      trialCancelled: false,
      hasActiveSubscription: true,
      ...fields,
    }) as ServiceStore;

  const whereOfFind = () =>
    JSON.stringify(
      (storeRepo.find.mock.calls[0] as [{ where: unknown }])[0].where,
    );

  beforeEach(async () => {
    storeRepo = {
      find: jest.fn(() => [store()]),
      count: jest.fn(() => 1),
      create: jest.fn((row: unknown) => row),
      save: jest.fn((row: unknown) => row),
    };
    subscriptionRepo = { findOne: jest.fn(() => null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceStoreService,
        { provide: getRepositoryToken(ServiceStore), useValue: storeRepo },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: {
            findOne: jest.fn(() => ({ id: 'plan-1', name: 'Monthly' })),
          },
        },
        { provide: ListingCleanupService, useValue: {} },
      ],
    }).compile();

    service = module.get<ServiceStoreService>(ServiceStoreService);
  });

  it('starts a new store off Explore, with no automatic free month', async () => {
    await service.createServiceStore({ name: 'Ada Cuts' } as never);

    const [row] = storeRepo.create.mock.calls[0] as [Partial<ServiceStore>];

    expect(row.hasActiveSubscription).toBe(false);
    expect(row.trialEndsAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('only lists stores on Explore to buyers', async () => {
    await service.findAllServiceStores({}, 'buyer-1');

    expect(whereOfFind()).toContain('hasActiveSubscription');
  });

  it("lists all of the seller's own stores", async () => {
    await service.findAllServiceStores({ ownerId: 'owner-1' }, 'owner-1');

    expect(whereOfFind()).not.toContain('hasActiveSubscription');
  });

  it('hides a store that is off Explore from buyers, not from its owner', async () => {
    storeRepo.find.mockReturnValue([store({ hasActiveSubscription: false })]);

    await expect(
      service.findServiceStoreById('store-1', {}, 'buyer-1'),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.findServiceStoreById('store-1', {}, 'owner-1'),
    ).resolves.toBeDefined();
  });

  describe('subscription status', () => {
    const statusOf = async (fields: Partial<ServiceStore>) => {
      storeRepo.find.mockReturnValue([store(fields)]);

      const { data } = await service.findServiceStoreById(
        'store-1',
        {},
        'owner-1',
      );

      return data.subscription;
    };

    it('is trial during the free month', async () => {
      await expect(statusOf({ createdAt: new Date() })).resolves.toEqual(
        expect.objectContaining({
          status: 'trial',
          isFreeTrial: true,
          isOnExplore: true,
        }),
      );
    });

    it('is active on a paid plan', async () => {
      subscriptionRepo.findOne.mockReturnValueOnce({
        planId: 'plan-1',
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date(),
      });

      await expect(statusOf({})).resolves.toEqual(
        expect.objectContaining({
          status: 'active',
          isFreeTrial: false,
          renews: true,
        }),
      );
    });

    it('is a free trial while a start-free-trial plan has not started billing', async () => {
      subscriptionRepo.findOne.mockReturnValueOnce({
        planId: 'plan-1',
        status: SubscriptionStatus.ACTIVE,
        isTrial: true,
        expiresAt: new Date(Date.now() + 20 * DAY),
      });

      await expect(statusOf({})).resolves.toEqual(
        expect.objectContaining({
          status: 'trial',
          isFreeTrial: true,
          plan: expect.objectContaining({ id: 'plan-1' }),
        }),
      );
    });

    it('is canceled, and can restart, after cancelling the free month', async () => {
      await expect(
        statusOf({ trialCancelled: true, hasActiveSubscription: false }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 'canceled',
          canRestartFree: true,
          isOnExplore: false,
        }),
      );
    });

    it('is expired once the free month ran out', async () => {
      await expect(
        statusOf({
          createdAt: new Date(Date.now() - 40 * DAY),
          hasActiveSubscription: false,
        }),
      ).resolves.toEqual(
        expect.objectContaining({ status: 'expired', canRestartFree: false }),
      );
    });
  });
});

import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { disablePaystackSubscription } from 'utils/paystack';
import { Subscription } from 'src/subscription/entities/subscription.entity';
import { SubscriptionStatus } from 'src/subscription/enums/subscription-status.enum';
import { ServiceStoreService } from './service-store.service';

jest.mock('utils/paystack');

describe('ServiceStoreService.deleteServiceStore', () => {
  let running: Partial<Subscription>[];
  let subscriptionRepo: { find: jest.Mock; update: jest.Mock; save: jest.Mock };
  let deleteListings: jest.Mock;
  let service: ServiceStoreService;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(disablePaystackSubscription).mockReset();

    running = [
      {
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        subscriptionCode: 'SUB_1',
        emailToken: 'TOKEN_1',
      },
    ];
    subscriptionRepo = {
      find: jest.fn(() => running),
      update: jest.fn(),
      save: jest.fn(),
    };
    deleteListings = jest.fn();

    service = new ServiceStoreService(
      {
        findOne: jest.fn(() => ({ id: 'store-1', logoKey: 'logo' })),
      } as never,
      subscriptionRepo as never,
      {} as never,
      { deleteListings } as never,
    );
  });

  it('cancels the subscription on Paystack, then deletes the store', async () => {
    await service.deleteServiceStore('store-1');

    expect(disablePaystackSubscription).toHaveBeenCalledWith(
      'SUB_1',
      'TOKEN_1',
    );
    expect(running[0].status).toBe(SubscriptionStatus.CANCELLED);
    expect(deleteListings).toHaveBeenCalled();
  });

  it('closes unfinished checkouts, so a late payment is refunded instead', async () => {
    await service.deleteServiceStore('store-1');

    expect(subscriptionRepo.update).toHaveBeenCalledWith(
      { storeId: 'store-1', status: SubscriptionStatus.PENDING },
      { status: SubscriptionStatus.FAILED },
    );
  });

  it("keeps the store while a just-paid plan hasn't got its Paystack code", async () => {
    running.push({ id: 'sub-2', status: SubscriptionStatus.ACTIVE });

    await expect(service.deleteServiceStore('store-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(disablePaystackSubscription).not.toHaveBeenCalled();
    expect(deleteListings).not.toHaveBeenCalled();
  });

  it('keeps the store when Paystack cannot cancel the subscription', async () => {
    jest
      .mocked(disablePaystackSubscription)
      .mockRejectedValue(new Error('down'));

    await expect(service.deleteServiceStore('store-1')).rejects.toThrow(
      BadGatewayException,
    );
    expect(deleteListings).not.toHaveBeenCalled();
  });
});

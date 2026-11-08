import { Subscription } from './entities/subscription.entity';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { SubscriptionExpirySweep } from './subscription-expiry.sweep';

jest.mock('src/service-store/store-visibility', () => ({
  syncStoreVisibility: jest.fn(),
}));

import { syncStoreVisibility } from 'src/service-store/store-visibility';

describe('SubscriptionExpirySweep', () => {
  const update = jest.fn();
  const find = jest.fn();
  const manager = { find, update };
  const sweep = new SubscriptionExpirySweep({
    manager,
    transaction: (run: (m: typeof manager) => unknown) => run(manager),
  } as never);

  beforeEach(() => jest.clearAllMocks());

  it('expires non-renewing plans past their end and updates the store', async () => {
    find.mockResolvedValue([{ id: 'sub-1', storeId: 'store-1' }]);

    await sweep.sweep();

    expect(update).toHaveBeenCalledWith(
      Subscription,
      { id: 'sub-1', status: SubscriptionStatus.NON_RENEWING },
      { status: SubscriptionStatus.EXPIRED },
    );
    expect(syncStoreVisibility).toHaveBeenCalledWith(manager, 'store-1');
  });

  it('only looks at non-renewing plans', async () => {
    find.mockResolvedValue([]);

    await sweep.sweep();

    expect(find).toHaveBeenCalledWith(
      Subscription,
      expect.objectContaining({
        where: expect.objectContaining({
          status: SubscriptionStatus.NON_RENEWING,
        }) as object,
      }),
    );
    expect(update).not.toHaveBeenCalled();
  });
});

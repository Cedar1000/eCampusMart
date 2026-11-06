import { HousingService } from 'src/housing/housing.service';
import { ProductService } from 'src/product/product.service';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { NotificationType } from './entities/notification.entity';

// A wallet with ₦1,000, and saves that echo what they were given
const fakeDataSource = (balance = 100000) => {
  const manager = {
    findOne: jest.fn((entity: unknown) =>
      entity === Wallet ? { id: 'wallet-1', balance, currency: 'NGN' } : null,
    ),
    create: jest.fn((_entity: unknown, row: object) => row),
    save: jest.fn((_entity: unknown, row: object) => ({
      id: 'listing-1',
      ...row,
    })),
  };
  return {
    transaction: (run: (m: typeof manager) => unknown) => run(manager),
  };
};

describe('listing fee notifications', () => {
  const notifications = { create: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('adds "Wallet debited" when a product is listed', async () => {
    const service = new ProductService(
      {} as never,
      {} as never,
      {} as never,
      fakeDataSource() as never,
      {} as never,
      notifications as never,
    );

    await service.create({ userId: 'user-1', quantity: 3, name: 'charger' });

    expect(notifications.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: NotificationType.WALLET_DEBITED,
      title: 'Wallet debited',
      body: '₦300 listing fee debited.',
      data: {
        reference: expect.any(String) as string,
        amount: 300,
        productId: 'listing-1',
      },
    });
  });

  it('adds "Wallet debited" when housing is listed', async () => {
    const service = new HousingService(
      {} as never,
      {} as never,
      {} as never,
      fakeDataSource() as never,
      {} as never,
      notifications as never,
    );

    await service.create({ userId: 'user-1' } as never);

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: NotificationType.WALLET_DEBITED,
        body: '₦500 listing fee debited.',
        data: expect.objectContaining({
          amount: 500,
          housingId: 'listing-1',
        }) as object,
      }),
    );
  });

  it("doesn't add one when the wallet can't pay the fee", async () => {
    const service = new ProductService(
      {} as never,
      {} as never,
      {} as never,
      fakeDataSource(0) as never,
      {} as never,
      notifications as never,
    );

    await expect(
      service.create({ userId: 'user-1', quantity: 1 }),
    ).rejects.toThrow('Insufficient wallet balance');
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

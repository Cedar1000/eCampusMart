import { lastValueFrom, of } from 'rxjs';

import { IncludePartiesInterceptor } from './include-parties.interceptor';

describe('IncludePartiesInterceptor', () => {
  const buyer = { id: 'buyer-1', firstName: 'Ada', lastName: 'Obi' };
  const sellerUser = { id: 'seller-1', firstName: 'Tunde', lastName: 'Bello' };
  const store = { id: 'store-1', name: 'Gadget Hub', logo: 'logo.png' };
  const product = {
    id: 'product-1',
    name: 'iPhone 12',
    description: 'Clean',
    price: '75000.50',
    images: [
      { url: 'first.png', isCoverImage: false },
      { url: 'cover.png', isCoverImage: true },
    ],
  };

  const userRepo = { find: jest.fn(() => [buyer, sellerUser]) };
  const storeRepo = { find: jest.fn(() => [store]) };
  const productRepo = { find: jest.fn(() => [product]) };

  const run = (response: unknown) =>
    lastValueFrom(
      new IncludePartiesInterceptor(
        userRepo as never,
        storeRepo as never,
        productRepo as never,
      ).intercept({} as never, { handle: () => of(response) }),
    );

  beforeEach(() => jest.clearAllMocks());

  it('adds the buyer, the selling user and the product', async () => {
    const result = await run({
      data: [
        { buyerId: 'buyer-1', sellerId: 'seller-1', productId: 'product-1' },
      ],
    });

    expect(result).toMatchObject({
      data: [
        {
          buyer,
          seller: { type: 'user', ...sellerUser },
          product: {
            id: 'product-1',
            name: 'iPhone 12',
            description: 'Clean',
            price: 75000.5,
            photo: 'cover.png',
          },
        },
      ],
    });
    expect(storeRepo.find).not.toHaveBeenCalled();
  });

  it('uses the store as the seller when there is a storeId', async () => {
    const result = await run({
      data: {
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        storeId: 'store-1',
        productId: 'product-1',
      },
    });

    expect(result).toMatchObject({
      data: { seller: { type: 'store', ...store } },
    });
  });

  it('gives null for a party that no longer exists', async () => {
    const result = await run({
      data: [{ buyerId: 'gone', sellerId: 'gone-too', productId: 'gone-3' }],
    });

    expect(result).toMatchObject({
      data: [{ buyer: null, seller: null, product: null }],
    });
  });

  it('leaves an empty list alone', async () => {
    await expect(run({ data: [] })).resolves.toEqual({ data: [] });
    expect(userRepo.find).not.toHaveBeenCalled();
  });
});

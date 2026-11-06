import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { OrderService } from 'src/order/order.service';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Offer, OfferSellerType, OfferStatus } from './entities/offer.entity';
import { OfferService } from './offer.service';
import { Product } from 'src/product/entities/product.entity';

describe('OfferService.update', () => {
  let offer: Partial<Offer> | null;
  let ownedStores: { entity: unknown; id: string; owner: string }[];
  let repo: {
    findOneBy: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    manager: { findOne: jest.Mock };
  };
  let orderService: { create: jest.Mock };
  let gateway: { notify: jest.Mock };
  let push: { send: jest.Mock };
  let service: OfferService;

  const answer = (status: OfferStatus, user: string) =>
    service.update('offer-1', { status } as never, user);
  const accept = (user = 'buyer-1') => answer(OfferStatus.ACCEPTED, user);
  const reject = (user = 'buyer-1') => answer(OfferStatus.REJECTED, user);
  const cancel = (user = 'seller-1') => answer(OfferStatus.CANCELLED, user);

  beforeEach(() => {
    offer = {
      id: 'offer-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      sellerType: OfferSellerType.USER,
      productId: 'product-1',
      amount: 500000,
      status: OfferStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    };
    ownedStores = [];

    repo = {
      findOneBy: jest.fn(() => offer && { ...offer }),
      save: jest.fn((fields: object) => fields),
      update: jest.fn(),
      manager: {
        // A store row with its owner, or the product's name
        findOne: jest.fn(
          (entity: unknown, { where }: { where: { id: string } }) => {
            if (entity === Product) return { id: where.id, name: 'iPhone 12' };
            const store = ownedStores.find(
              (owned) => owned.entity === entity && owned.id === where.id,
            );
            return (
              store && {
                id: store.id,
                userId: store.owner,
                ownerId: store.owner,
              }
            );
          },
        ),
      },
    };
    orderService = {
      create: jest.fn(() => ({ data: { id: 'order-1', amount: 500000 } })),
    };
    gateway = { notify: jest.fn() };
    push = { send: jest.fn() };
    service = new OfferService(
      repo as never,
      orderService as unknown as OrderService,
      gateway as never,
      push as never,
    );
  });

  describe('accept', () => {
    it('orders the product at the offer amount and returns the offer in naira', async () => {
      const result = await accept();

      expect(orderService.create).toHaveBeenCalledWith(
        { productId: 'product-1' },
        'buyer-1',
        expect.objectContaining({ id: 'offer-1', amount: 500000 }),
      );
      expect(result.data).toMatchObject({
        status: OfferStatus.ACCEPTED,
        amount: 5000,
        order: { id: 'order-1' },
      });
    });

    it('tells both sides the offer was accepted', async () => {
      await accept();

      expect(gateway.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'offer-1',
          status: OfferStatus.ACCEPTED,
        }),
      );
    });

    it('leaves the offer pending when the product is no longer available', async () => {
      orderService.create.mockRejectedValue(new ConflictException('taken'));

      await expect(accept()).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(gateway.notify).not.toHaveBeenCalled();
    });

    it('refuses the seller', async () => {
      await expect(accept('seller-1')).rejects.toThrow(
        'Only the buyer can answer this offer',
      );
      expect(orderService.create).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('only updates the offer, and tells both sides', async () => {
      const result = await reject();

      expect(result.data).toMatchObject({ status: OfferStatus.REJECTED });
      expect(orderService.create).not.toHaveBeenCalled();
      expect(gateway.notify).toHaveBeenCalledWith(
        expect.objectContaining({ status: OfferStatus.REJECTED }),
      );
    });

    it('refuses anyone but the buyer', async () => {
      await expect(reject('other')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('lets the selling user cancel, and tells both sides', async () => {
      const result = await cancel();

      expect(result.data).toMatchObject({ status: OfferStatus.CANCELLED });
      expect(gateway.notify).toHaveBeenCalledWith(
        expect.objectContaining({ status: OfferStatus.CANCELLED }),
      );
    });

    it.each([
      [OfferSellerType.PRODUCT_STORE, ProductStore],
      [OfferSellerType.SERVICE_STORE, ServiceStore],
    ])(
      "lets the owner of the %s cancel the store's offer",
      async (type, entity) => {
        Object.assign(offer!, { sellerType: type, sellerId: 'store-1' });
        ownedStores = [{ entity, id: 'store-1', owner: 'owner-1' }];

        await expect(cancel('owner-1')).resolves.toMatchObject({
          data: { status: OfferStatus.CANCELLED },
        });
        await expect(cancel('someone-else')).rejects.toThrow(
          'Only the seller can cancel this offer',
        );
      },
    );

    it('refuses the buyer', async () => {
      await expect(cancel('buyer-1')).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  it('refuses an offer that was already answered', async () => {
    offer!.status = OfferStatus.REJECTED;

    await expect(accept()).rejects.toThrow('This offer is already rejected');
    await expect(cancel()).rejects.toThrow('This offer is already rejected');
  });

  it('marks an offer past its expiry as expired, tells both sides, and refuses it', async () => {
    offer!.expiresAt = new Date(Date.now() - 1000);

    await expect(accept()).rejects.toThrow(BadRequestException);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OfferStatus.EXPIRED }),
    );
    expect(gateway.notify).toHaveBeenCalledWith(
      expect.objectContaining({ status: OfferStatus.EXPIRED }),
    );
    expect(orderService.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown offer', async () => {
    offer = null;

    await expect(reject()).rejects.toThrow(NotFoundException);
  });

  describe('push', () => {
    it('pushes an accepted offer to the seller, not the buyer who accepted', async () => {
      await accept();

      expect(push.send).toHaveBeenCalledWith(['seller-1'], {
        title: 'Offer accepted',
        body: 'Your ₦5,000 offer for iPhone 12 was accepted',
        data: {
          type: 'offer-updated',
          offerId: 'offer-1',
          status: OfferStatus.ACCEPTED,
        },
      });
    });

    it('pushes a declined offer to the seller', async () => {
      await reject();

      expect(push.send).toHaveBeenCalledWith(
        ['seller-1'],
        expect.objectContaining({ title: 'Offer declined' }),
      );
    });

    it("pushes a store's cancelled offer to the buyer, not the owner who cancelled", async () => {
      Object.assign(offer!, {
        sellerType: OfferSellerType.PRODUCT_STORE,
        sellerId: 'store-1',
      });
      ownedStores = [{ entity: ProductStore, id: 'store-1', owner: 'owner-1' }];

      await cancel('owner-1');

      expect(push.send).toHaveBeenCalledWith(
        ['buyer-1'],
        expect.objectContaining({ title: 'Offer withdrawn' }),
      );
    });

    it("pushes an expired offer to the store's owner", async () => {
      Object.assign(offer!, {
        sellerType: OfferSellerType.SERVICE_STORE,
        sellerId: 'store-1',
        expiresAt: new Date(Date.now() - 1000),
      });
      ownedStores = [{ entity: ServiceStore, id: 'store-1', owner: 'owner-1' }];

      await expect(accept()).rejects.toThrow('This offer has expired');

      expect(push.send).toHaveBeenCalledWith(
        ['owner-1'],
        expect.objectContaining({ title: 'Offer expired' }),
      );
    });

    it("doesn't fail the request when the push fails", async () => {
      push.send.mockRejectedValue(new Error('expo down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(reject()).resolves.toMatchObject({
        data: { status: OfferStatus.REJECTED },
      });
    });
  });
});

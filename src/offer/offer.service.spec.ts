import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { OrderService } from 'src/order/order.service';
import { Offer, OfferStatus } from './entities/offer.entity';
import { OfferService } from './offer.service';

describe('OfferService.update', () => {
  let offer: Partial<Offer> | null;
  let repo: { findOneBy: jest.Mock; save: jest.Mock; update: jest.Mock };
  let orderService: { create: jest.Mock };
  let service: OfferService;

  const accept = (user = 'buyer-1') =>
    service.update('offer-1', { status: OfferStatus.ACCEPTED }, user);
  const reject = (user = 'buyer-1') =>
    service.update('offer-1', { status: OfferStatus.REJECTED }, user);

  beforeEach(() => {
    offer = {
      id: 'offer-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      productId: 'product-1',
      amount: 500000,
      status: OfferStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    };
    repo = {
      findOneBy: jest.fn(() => offer && { ...offer }),
      save: jest.fn((fields: object) => fields),
      update: jest.fn(),
    };
    orderService = {
      create: jest.fn(() => ({ data: { id: 'order-1', amount: 500000 } })),
    };
    service = new OfferService(
      repo as never,
      orderService as unknown as OrderService,
    );
  });

  it('accepting orders the product at the offer amount', async () => {
    const result = await accept();

    expect(orderService.create).toHaveBeenCalledWith(
      { productId: 'product-1' },
      'buyer-1',
      expect.objectContaining({ id: 'offer-1', amount: 500000 }),
    );
    expect(result.data).toMatchObject({
      status: OfferStatus.ACCEPTED,
      order: { id: 'order-1' },
    });
  });

  it('accepting expires the other pending offers on the product', async () => {
    await accept();

    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        status: OfferStatus.PENDING,
      }),
      { status: OfferStatus.EXPIRED_BY_ACCEPTANCE },
    );
  });

  it('leaves the offer pending when the product is no longer available', async () => {
    orderService.create.mockRejectedValue(new ConflictException('taken'));

    await expect(accept()).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejecting only updates the offer', async () => {
    const result = await reject();

    expect(result.data).toMatchObject({ status: OfferStatus.REJECTED });
    expect(orderService.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('refuses anyone but the buyer', async () => {
    await expect(accept('seller-1')).rejects.toThrow(ForbiddenException);
    expect(orderService.create).not.toHaveBeenCalled();
  });

  it('refuses an offer that was already answered', async () => {
    offer!.status = OfferStatus.REJECTED;

    await expect(accept()).rejects.toThrow('This offer is already rejected');
  });

  it('marks an offer past its expiry as expired and refuses it', async () => {
    offer!.expiresAt = new Date(Date.now() - 1000);

    await expect(accept()).rejects.toThrow(BadRequestException);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OfferStatus.EXPIRED }),
    );
    expect(orderService.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown offer', async () => {
    offer = null;

    await expect(reject()).rejects.toThrow(NotFoundException);
  });
});

import { Logger } from '@nestjs/common';

import { Offer } from './entities/offer.entity';
import { OfferGateway } from './offer.gateway';

describe('OfferGateway', () => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const redis = { mget: jest.fn() };
  const gateway = new OfferGateway(redis as never);
  Object.assign(gateway, { server: { to } });

  const offer = {
    id: 'offer-1',
    sellerId: 'store-1',
    buyerId: 'buyer-1',
    amount: 500000,
    status: 'accepted',
  } as Offer;

  beforeEach(() => jest.clearAllMocks());

  it('sends offer-updated to the online seller and buyer, in naira', async () => {
    redis.mget.mockResolvedValue(['socket-owner', 'socket-buyer']);

    await gateway.notify(offer, 'conversation-1');

    expect(redis.mget).toHaveBeenCalledWith('user-store-1', 'user-buyer-1');
    expect(to.mock.calls).toEqual([['socket-owner'], ['socket-buyer']]);
    expect(emit).toHaveBeenCalledWith('offer-updated', {
      offer: { ...offer, amount: 5000 },
      conversationId: 'conversation-1',
    });
  });

  it('sends once when both ids share a socket', async () => {
    redis.mget.mockResolvedValue(['socket-1', 'socket-1']);

    await gateway.notify(offer, 'conversation-1');

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("doesn't throw when Redis fails", async () => {
    redis.mget.mockRejectedValue(new Error('redis down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(gateway.notify(offer, null)).resolves.toBeUndefined();
  });
});

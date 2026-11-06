import { Inject, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server } from 'socket.io';

import { emitToOnline } from 'src/common/live-events/emit-to-online';
import { REDIS_CLIENT } from 'src/redis/constants/redis.constant';
import { Offer } from './entities/offer.entity';

// Shares the chat's socket server; it only sends, so it has no handlers
@WebSocketGateway({ cors: { origin: '*' } })
export class OfferGateway {
  private readonly logger = new Logger(OfferGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  // Sends `offer-updated`, with the chat the offer is in, to the buyer and the
  // seller (a store's owner, for a store's offer) that are online. Never
  // throws: a missed event mustn't fail the request
  async notify(offer: Offer, conversationId: string | null) {
    try {
      await emitToOnline(
        this.server,
        this.redisClient,
        [offer.sellerId, offer.buyerId],
        'offer-updated',
        { offer: { ...offer, amount: offer.amount / 100 }, conversationId },
      );
    } catch (error) {
      this.logger.error(`offer-updated for offer ${offer.id} failed`, error);
    }
  }
}

import { Inject, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server } from 'socket.io';

import { emitToOnline } from 'src/common/live-events/emit-to-online';
import { REDIS_CLIENT } from 'src/redis/constants/redis.constant';
import { Order } from './entities/order.entity';

export type OrderAction = 'placed' | 'cancelled' | 'completed' | 'expired';

// Shares the chat's socket server; it only sends, so it has no handlers. The
// seller of a store order is its owner, who shares the store's socket
@WebSocketGateway({ cors: { origin: '*' } })
export class OrderGateway {
  private readonly logger = new Logger(OrderGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  // Sends `order-updated` to the seller and the buyer that are online. Never
  // throws: a missed event mustn't fail the order
  async notify(
    order: Pick<Order, 'id' | 'sellerId' | 'buyerId' | 'amount'>,
    action: OrderAction,
  ) {
    try {
      const payload = {
        action,
        order: { ...order, amount: Number(order.amount) / 100 },
      };

      await emitToOnline(
        this.server,
        this.redisClient,
        [order.sellerId, order.buyerId],
        'order-updated',
        payload,
      );
    } catch (error) {
      this.logger.error(`order-updated for order ${order.id} failed`, error);
    }
  }
}

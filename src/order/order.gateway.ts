import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import { Repository } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { emitToOnline } from 'src/common/live-events/emit-to-online';
import { PushService } from 'src/notification/push.service';
import { Product } from 'src/product/entities/product.entity';
import { REDIS_CLIENT } from 'src/redis/constants/redis.constant';
import { Order } from './entities/order.entity';

export type OrderAction = 'placed' | 'cancelled' | 'completed' | 'expired';

type NotifiedOrder = Pick<
  Order,
  'id' | 'sellerId' | 'buyerId' | 'amount' | 'productId' | 'quantity'
>;

const PUSH_TITLES: Record<OrderAction, string> = {
  placed: 'New order',
  cancelled: 'Order cancelled',
  completed: 'Order completed',
  expired: 'Order expired',
};

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

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly pushService: PushService,
  ) {}

  // Sends `order-updated` to the seller and the buyer that are online, and a
  // push to their phones, except to whoever made the change (`actorId`). Never
  // throws: a missed event mustn't fail the order
  async notify(order: NotifiedOrder, action: OrderAction, actorId?: string) {
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

      await this.push(order, action, actorId);
    } catch (error) {
      this.logger.error(`order-updated for order ${order.id} failed`, error);
    }
  }

  private async push(
    order: NotifiedOrder,
    action: OrderAction,
    actorId?: string,
  ) {
    const userIds = [order.sellerId, order.buyerId].filter(
      (id) => id !== actorId,
    );
    if (!userIds.length) return;

    const [product, buyer] = await Promise.all([
      this.productRepo.findOne({
        where: { id: order.productId },
        select: ['id', 'name'],
      }),
      this.userRepo.findOne({
        where: { id: order.buyerId },
        select: ['id', 'firstName', 'lastName'],
      }),
    ]);

    const item = `${order.quantity > 1 ? `${order.quantity} × ` : ''}${product?.name ?? 'a product'}`;
    const buyerName =
      [buyer?.firstName, buyer?.lastName].filter(Boolean).join(' ') ||
      'Someone';

    const bodies: Record<OrderAction, string> = {
      placed: `${buyerName} ordered ${item}`,
      cancelled: `The order for ${item} was cancelled`,
      completed: `The order for ${item} is complete`,
      expired: `The order for ${item} expired before it was completed`,
    };

    await this.pushService.send(userIds, {
      title: PUSH_TITLES[action],
      body: bodies[action],
      data: { type: 'order-updated', orderId: order.id, action },
    });
  }
}

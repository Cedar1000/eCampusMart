import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import { Repository } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { emitToOnline } from 'src/common/live-events/emit-to-online';
import { PushService } from 'src/notification/push.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { Product } from 'src/product/entities/product.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { REDIS_CLIENT } from 'src/redis/constants/redis.constant';
import { Order } from './entities/order.entity';

export type OrderAction = 'placed' | 'cancelled' | 'completed' | 'expired';

type NotifiedOrder = Pick<
  Order,
  | 'id'
  | 'orderId'
  | 'sellerId'
  | 'buyerId'
  | 'amount'
  | 'productId'
  | 'quantity'
> &
  Partial<Pick<Order, 'cancelledBy' | 'cancelledByRole'>>;

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

    private readonly notificationService: NotificationService,
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

      await this.addNotification(order, action, actorId);
      await this.push(order, action, actorId);
    } catch (error) {
      this.logger.error(`order-updated for order ${order.id} failed`, error);
    }
  }

  // Adds "New order", "Order completed" or "Order cancelled" to the list of
  // whoever didn't make the change, e.g. "Adaeze cancelled ORD-2113 before
  // handover." Expired orders are only pushed
  private async addNotification(
    order: NotifiedOrder,
    action: OrderAction,
    actorId?: string,
  ) {
    if (action === 'placed') {
      const { buyerName, item } = await this.describe(order);
      await this.notificationService.create({
        userId: order.sellerId,
        type: NotificationType.ORDER_PLACED,
        title: PUSH_TITLES.placed,
        body: `${buyerName} ordered ${item}`,
        data: { orderId: order.id, productId: order.productId },
      });
      return;
    }
    if (action !== 'completed' && action !== 'cancelled') return;

    const actor = actorId
      ? await this.userRepo.findOne({
          where: { id: actorId },
          select: ['id', 'firstName'],
        })
      : null;
    const name = actor?.firstName || 'The other party';
    // Orders from before order codes were added may have none
    const code = order.orderId || 'the order';
    const orderLabel = order.orderId ? `order ${order.orderId}` : 'the order';

    const body =
      action === 'cancelled'
        ? `${name} cancelled ${code} before handover.`
        : actorId === order.sellerId
          ? `${name} scanned your code, ${orderLabel} is complete.`
          : `${name} marked ${orderLabel} as complete.`;

    await this.notificationService.create(
      ...[order.sellerId, order.buyerId]
        .filter((id) => id !== actorId)
        .map((userId) => ({
          userId,
          type:
            action === 'cancelled'
              ? NotificationType.ORDER_CANCELLED
              : NotificationType.ORDER_COMPLETED,
          title: action === 'cancelled' ? 'Order cancelled' : 'Order completed',
          body,
          data: { orderId: order.id, productId: order.productId },
        })),
    );
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

    const { buyerName, item } = await this.describe(order);
    const canceller =
      action === 'cancelled' ? await this.cancellerName(order, buyerName) : '';

    const bodies: Record<OrderAction, string> = {
      placed: `${buyerName} ordered ${item}`,
      cancelled: `${canceller} cancelled the order for ${item}`,
      completed: `The order for ${item} is complete`,
      expired: `The order for ${item} expired before it was completed`,
    };

    await this.pushService.send(userIds, {
      title: PUSH_TITLES[action],
      body: bodies[action],
      data: {
        type: 'order-updated',
        orderId: order.id,
        action,
        ...(action === 'cancelled' && {
          cancelledBy: order.cancelledBy ?? null,
          cancelledByRole: order.cancelledByRole ?? null,
        }),
      },
    });
  }

  // "Ada Obi" for the buyer; the seller's name, or their store's for a store order
  private async cancellerName(order: NotifiedOrder, buyerName: string) {
    if (order.cancelledByRole === 'buyer') return buyerName;

    if (order.cancelledByRole === 'seller') {
      const store =
        order.cancelledBy && order.cancelledBy !== order.sellerId
          ? await this.productRepo.manager.findOne(ProductStore, {
              where: { id: order.cancelledBy },
              select: ['id', 'name'],
            })
          : null;
      if (store?.name) return store.name;

      const seller = await this.userRepo.findOne({
        where: { id: order.sellerId },
        select: ['id', 'firstName', 'lastName'],
      });
      const name = [seller?.firstName, seller?.lastName]
        .filter(Boolean)
        .join(' ');
      if (name) return name;
    }

    return 'The other party';
  }

  // "2 × iphone 12" and the buyer's full name, for the order's texts
  private async describe(order: NotifiedOrder) {
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

    return { buyerName, item };
  }
}

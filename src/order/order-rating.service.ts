import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, QueryFailedError, Repository } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { NotificationService } from 'src/notification/notification.service';
import { PushService } from 'src/notification/push.service';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { RateOrderDto } from './dto/rate-order.dto';
import {
  OrderRating,
  OrderRatingRole,
  RateeType,
} from './entities/order-rating.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';

const UNIQUE_VIOLATION = '23505';

export type OrderRatings = Record<OrderRatingRole, OrderRating | null>;

@Injectable()
export class OrderRatingService {
  private readonly logger = new Logger(OrderRatingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderRating)
    private readonly ratingRepo: Repository<OrderRating>,

    private readonly pushService: PushService,

    private readonly notificationService: NotificationService,
  ) {}

  // The buyer rates the seller (its store, for a store order) and the seller
  // rates the buyer, once each, after the order is completed. The rating is
  // added to the rated user's or store's average, and they're told about it
  async rate(
    orderId: string,
    { stars, comment }: RateOrderDto,
    userId: string,
  ) {
    const order = await this.orderRepo.findOneBy({ id: orderId });

    if (!order) throw new NotFoundException('No resource with that ID');

    const raterRole =
      order.buyerId === userId
        ? OrderRatingRole.BUYER
        : order.sellerId === userId
          ? OrderRatingRole.SELLER
          : null;

    if (!raterRole) throw new ForbiddenException('This order is not yours');

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('You can only rate a completed order');
    }

    const ratee =
      raterRole === OrderRatingRole.SELLER
        ? { id: order.buyerId, type: RateeType.USER }
        : order.isStoreOrder && order.storeId
          ? { id: order.storeId, type: RateeType.PRODUCT_STORE }
          : { id: order.sellerId, type: RateeType.USER };

    let rating: OrderRating;
    try {
      rating = await this.ratingRepo.manager.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(OrderRating, {
            orderId,
            raterId: userId,
            raterRole,
            rateeId: ratee.id,
            rateeType: ratee.type,
            stars,
            comment: comment?.trim() || null,
          }),
        );

        await this.addToAverage(manager, ratee, stars);

        return saved;
      });
    } catch (error) {
      if (
        (error as QueryFailedError & { code?: string }).code ===
        UNIQUE_VIOLATION
      ) {
        throw new ConflictException('You have already rated this order');
      }
      throw error;
    }

    // The store's owner is the order's seller
    const rateeUserId =
      raterRole === OrderRatingRole.SELLER ? order.buyerId : order.sellerId;
    await this.notifyRatee(rating, rateeUserId);

    return {
      status: 'success',
      message: 'create successful!',
      data: { ...order, ratings: (await this.findRatings([orderId]))[orderId] },
    };
  }

  // Both sides' ratings for each order, null where a side hasn't rated yet
  async findRatings(orderIds: string[]) {
    const byOrder: Record<string, OrderRatings> = {};
    for (const id of orderIds) {
      byOrder[id] = {
        [OrderRatingRole.BUYER]: null,
        [OrderRatingRole.SELLER]: null,
      };
    }
    if (!orderIds.length) return byOrder;

    const ratings = await this.ratingRepo.find({
      where: { orderId: In(orderIds) },
    });
    for (const rating of ratings) {
      byOrder[rating.orderId][rating.raterRole] = rating;
    }

    return byOrder;
  }

  // One UPDATE, so ratings saved at the same moment can't overwrite each other
  private async addToAverage(
    manager: EntityManager,
    ratee: { id: string; type: RateeType },
    stars: number,
  ) {
    await manager
      .createQueryBuilder()
      .update(ratee.type === RateeType.USER ? User : ProductStore)
      .set({
        ratingsAverage: () =>
          '(COALESCE(ratingsAverage, 0) * ratingsCount + :stars) / (ratingsCount + 1)',
        ratingsCount: () => 'ratingsCount + 1',
      })
      .where('id = :id', { id: ratee.id, stars })
      .execute();
  }

  // "New review: Ada rated you 5 stars", as a push, a saved notification and,
  // through the saved notification, the socket. Never throws
  private async notifyRatee(rating: OrderRating, rateeUserId: string) {
    try {
      const rater = await this.ratingRepo.manager.findOne(User, {
        where: { id: rating.raterId },
        select: ['id', 'firstName'],
      });
      const title = 'New review';
      const body = `${rater?.firstName || 'Someone'} rated you ${rating.stars} ${rating.stars === 1 ? 'star' : 'stars'}`;

      await this.pushService.send([rateeUserId], {
        title,
        body,
        data: {
          type: 'review-received',
          orderId: rating.orderId,
          stars: rating.stars,
        },
      });

      await this.notificationService.create({
        userId: rateeUserId,
        type: NotificationType.REVIEW_RECEIVED,
        title,
        body,
        data: {
          orderId: rating.orderId,
          stars: rating.stars,
          ratingId: rating.id,
        },
      });
    } catch (error) {
      this.logger.error(`Review notice for ${rating.id} failed`, error);
    }
  }
}

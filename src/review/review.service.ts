import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, EntityManager, In, Repository } from 'typeorm';

import type IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { User } from 'src/auth/entities/user.entity';
import { Conversation } from 'src/chat/entities/conversation.entity';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { NotificationService } from 'src/notification/notification.service';
import { PushService } from 'src/notification/push.service';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Service } from 'src/service/entities/service.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  PendingReview,
  PendingReviewStatus,
} from './entities/pending-review.entity';
import { Review, ReviewPartyType } from './entities/review.entity';

const UNIQUE_VIOLATION = '23505';

// Where each kind of receiver keeps its ratingsCount and ratingsAverage
const RECEIVER_ENTITY = {
  [ReviewPartyType.USER]: User,
  [ReviewPartyType.PRODUCT_STORE]: ProductStore,
  [ReviewPartyType.SERVICE_STORE]: ServiceStore,
};

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,

    @InjectRepository(PendingReview)
    private readonly pendingReviewRepo: Repository<PendingReview>,

    private readonly pushService: PushService,

    private readonly notificationService: NotificationService,
  ) {}

  private readonly logger = new Logger(ReviewService.name);

  // Paged, filtered and sorted like the other lists, e.g. ?receiverId=…&sort=-createdAt
  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.reviewRepo, query);
  }

  // Only the pending reviews the user has to write: as themselves, or as one
  // of their stores. A senderId in the query can't widen this
  async findAllPending(query: Partial<IQuery>, userId: string) {
    const manager = this.pendingReviewRepo.manager;
    const [productStores, serviceStores] = await Promise.all([
      manager.find(ProductStore, { where: { userId }, select: ['id'] }),
      manager.find(ServiceStore, {
        where: { ownerId: userId },
        select: ['id'],
      }),
    ]);
    const senderIds = [
      userId,
      ...[...productStores, ...serviceStores].map(({ id }) => id),
    ];

    return await factory.getAll(this.pendingReviewRepo, query, {
      senderId: In(senderIds),
    });
  }

  // An order review comes from a pending review; a service store review
  // from a chat with the store
  async create(dto: CreateReviewDto, userId: string) {
    if (dto.pendingReviewId && dto.serviceStoreId) {
      throw new BadRequestException(
        'Send either pendingReviewId or serviceStoreId, not both',
      );
    }

    if (dto.serviceId && !dto.serviceStoreId) {
      throw new BadRequestException('serviceId goes with serviceStoreId');
    }

    const review = dto.serviceStoreId
      ? await this.reviewServiceStore(dto.serviceStoreId, dto, userId)
      : await this.reviewOrder(dto.pendingReviewId as string, dto, userId);

    // After the transaction, so a review that rolled back tells nobody
    await this.notifyReceiver(review);

    return { status: 'success', message: 'create successful!', data: review };
  }

  // "New review: Ada rated you 5 stars" to the reviewed user, or the store's
  // owner, as a push, a saved notification and (through the saved
  // notification) the socket. Never throws: the review is already saved
  private async notifyReceiver(review: Review) {
    try {
      const manager = this.reviewRepo.manager;
      const [ownerId, senderName] = await Promise.all([
        this.partyOwnerId(manager, review.receiverId, review.receiverType),
        this.partyName(manager, review.senderId, review.senderType),
      ]);

      if (!ownerId) return;

      const title = 'New review';
      const body = `${senderName || 'Someone'} rated you ${review.rating} ${review.rating === 1 ? 'star' : 'stars'}`;
      const orderId = review.orderId ?? null;

      await this.pushService.send([ownerId], {
        title,
        body,
        data: { type: 'review-received', orderId, stars: review.rating },
      });

      await this.notificationService.create({
        userId: ownerId,
        type: NotificationType.REVIEW_RECEIVED,
        title,
        body,
        data: {
          orderId,
          stars: review.rating,
          reviewId: review.id,
          receiverId: review.receiverId,
          receiverType: review.receiverType,
        },
      });
    } catch (error) {
      this.logger.error(`Review notice for ${review.id} failed`, error);
    }
  }

  // The user behind a user or store id: a store's owner
  private async partyOwnerId(
    manager: EntityManager,
    id: string,
    type: ReviewPartyType,
  ) {
    if (type === ReviewPartyType.USER) return id;

    if (type === ReviewPartyType.PRODUCT_STORE) {
      const store = await manager.findOne(ProductStore, {
        where: { id },
        select: ['id', 'userId'],
      });
      return store?.userId ?? null;
    }

    const store = await manager.findOne(ServiceStore, {
      where: { id },
      select: ['id', 'ownerId'],
    });
    return store?.ownerId ?? null;
  }

  // A user's first name, or a store's name
  private async partyName(
    manager: EntityManager,
    id: string,
    type: ReviewPartyType,
  ) {
    if (type === ReviewPartyType.USER) {
      const user = await manager.findOne(User, {
        where: { id },
        select: ['id', 'firstName'],
      });
      return user?.firstName ?? null;
    }

    const store = await manager.findOne(
      type === ReviewPartyType.PRODUCT_STORE ? ProductStore : ServiceStore,
      { where: { id }, select: ['id', 'name'] },
    );
    return store?.name ?? null;
  }

  // Any user who has chatted with the store, except its owner, once per store
  private async reviewServiceStore(
    storeId: string,
    { rating, body, serviceId }: CreateReviewDto,
    userId: string,
  ) {
    const manager = this.reviewRepo.manager;
    const store = await manager.findOne(ServiceStore, {
      where: { id: storeId },
      select: ['id', 'ownerId'],
    });

    if (!store) throw new NotFoundException('No resource with that ID');

    if (store.ownerId === userId) {
      throw new ForbiddenException("You can't review your own store");
    }

    const hasChatted = await manager.exists(Conversation, {
      where: { participants: ArrayContains([userId, storeId]) },
    });

    if (!hasChatted) {
      throw new ForbiddenException('Chat with this store before reviewing it');
    }

    if (
      serviceId &&
      !(await manager.exists(Service, { where: { id: serviceId, storeId } }))
    ) {
      throw new BadRequestException('That service is not from this store');
    }

    try {
      return await manager.transaction(async (tx) => {
        const review = await tx.save(
          tx.create(Review, {
            pendingReviewId: null,
            orderId: null,
            productId: null,
            serviceId: serviceId ?? null,
            buyerId: userId,
            sellerId: store.ownerId,
            senderId: userId,
            senderIsStore: false,
            senderType: ReviewPartyType.USER,
            receiverId: store.id,
            receiverIsStore: true,
            receiverType: ReviewPartyType.SERVICE_STORE,
            rating,
            body,
          }),
        );

        await this.updateReceiverRatings(tx, review);

        return review;
      });
    } catch (error) {
      // The unique index on a user's service store review
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('You have already reviewed this store');
      }
      throw error;
    }
  }

  // Only the pending review's sender can write it: the user themselves, or
  // the owner of the store it's sent as. Once only
  private async reviewOrder(
    pendingReviewId: string,
    { rating, body }: CreateReviewDto,
    userId: string,
  ) {
    return await this.reviewRepo.manager.transaction(async (manager) => {
      const pending = await manager.findOne(PendingReview, {
        where: { id: pendingReviewId },
      });

      if (!pending) throw new NotFoundException('No resource with that ID');

      const senderType = await this.senderType(manager, pending, userId);

      if (!senderType) {
        throw new ForbiddenException('This review is not yours to write');
      }

      // Conditional, so two requests at once can't both write the review
      const claimed = await manager.update(
        PendingReview,
        { id: pending.id, status: PendingReviewStatus.PENDING },
        { status: PendingReviewStatus.COMPLETED },
      );

      if (!claimed.affected) {
        throw new ConflictException('You have already written this review');
      }

      const review = await manager.save(
        manager.create(Review, {
          pendingReviewId: pending.id,
          orderId: pending.orderId ?? null,
          productId: pending.productId ?? null,
          serviceId: pending.serviceId ?? null,
          buyerId: pending.buyerId,
          sellerId: pending.sellerId,
          senderId: pending.senderId,
          senderIsStore: pending.senderIsStore,
          senderType,
          receiverId: pending.receiverId,
          receiverIsStore: pending.receiverIsStore,
          receiverType: await this.receiverType(manager, pending),
          rating,
          body,
        }),
      );

      await this.updateReceiverRatings(manager, review);

      return review;
    });
  }

  // Recounts the receiver's ratingsCount and ratingsAverage from all their
  // reviews. The receiver's row is locked first, so two reviews at once are
  // counted one after the other and neither is lost
  private async updateReceiverRatings(
    manager: EntityManager,
    { receiverId, receiverType }: Review,
  ) {
    const receiver = RECEIVER_ENTITY[receiverType];

    await manager
      .createQueryBuilder(receiver, 'receiver')
      .setLock('pessimistic_write')
      .where('receiver.id = :id', { id: receiverId })
      .select('receiver.id')
      .getOne();

    const totals = await manager
      .createQueryBuilder(Review, 'review')
      .select('COUNT(*)', 'count')
      .addSelect('AVG(review.rating)', 'average')
      .where('review."receiverId" = :receiverId', { receiverId })
      .andWhere('review."receiverType" = :receiverType', { receiverType })
      .getRawOne<{ count: string; average: string | null }>();

    const count = Number(totals?.count ?? 0);

    await manager.update(receiver, receiverId, {
      ratingsCount: count,
      // Rounded to 2 decimals, e.g. 4.67
      ratingsAverage: count
        ? Math.round(Number(totals?.average) * 100) / 100
        : 0,
    });
  }

  // The sender's type, or null when the user isn't the sender or its owner
  private async senderType(
    manager: EntityManager,
    { senderId, senderIsStore }: PendingReview,
    userId: string,
  ) {
    if (!senderIsStore) {
      return senderId === userId ? ReviewPartyType.USER : null;
    }

    if (
      await manager.exists(ProductStore, { where: { id: senderId, userId } })
    ) {
      return ReviewPartyType.PRODUCT_STORE;
    }

    if (
      await manager.exists(ServiceStore, {
        where: { id: senderId, ownerId: userId },
      })
    ) {
      return ReviewPartyType.SERVICE_STORE;
    }

    return null;
  }

  private async receiverType(
    manager: EntityManager,
    { receiverId, receiverIsStore }: PendingReview,
  ) {
    if (!receiverIsStore) return ReviewPartyType.USER;

    return (await manager.exists(ProductStore, { where: { id: receiverId } }))
      ? ReviewPartyType.PRODUCT_STORE
      : ReviewPartyType.SERVICE_STORE;
  }
}

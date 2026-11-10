import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import * as factory from 'utils/handlerFactory';
import { User } from 'src/auth/entities/user.entity';
import { Conversation } from 'src/chat/entities/conversation.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { Service } from 'src/service/entities/service.entity';
import {
  PendingReview,
  PendingReviewStatus,
} from './entities/pending-review.entity';
import { Review, ReviewPartyType } from './entities/review.entity';
import { ReviewService } from './review.service';

jest.mock('utils/handlerFactory', () => ({ getAll: jest.fn() }));

type Where = Record<string, unknown>;

describe('ReviewService', () => {
  let service: ReviewService;
  let pending: Partial<PendingReview> | null;
  let productStores: Where[];
  let serviceStores: Where[];
  let hasChatted: boolean;
  let services: Where[];
  let manager: {
    findOne: jest.Mock;
    update: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    transaction: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  // Reviews saved so far, and each receiver's ratings as last written
  let saved: Where[];
  let ratings: Map<unknown, Where>;
  let locked: unknown[];
  const pendingReviewRepo = {
    manager: {
      find: jest.fn((entity: unknown, { where }: { where: Where }) =>
        (entity === ProductStore ? productStores : serviceStores).filter(
          (store) =>
            Object.entries(where).every(([key, value]) => store[key] === value),
        ),
      ),
    },
  };

  const matches = (rows: Where[], where: Where) =>
    rows.some((row) =>
      Object.entries(where).every(([key, value]) => row[key] === value),
    );

  const write = (userId: string, pendingReviewId = 'pending-1') =>
    service.create(
      { pendingReviewId, rating: 5, body: 'quick pickup' },
      userId,
    );

  beforeEach(async () => {
    jest.clearAllMocks();

    pending = {
      id: 'pending-1',
      orderId: 'order-1',
      productId: 'product-1',
      status: PendingReviewStatus.PENDING,
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      senderId: 'buyer-1',
      senderIsStore: false,
      receiverId: 'seller-1',
      receiverIsStore: false,
    };
    productStores = [{ id: 'store-1', userId: 'seller-1' }];
    serviceStores = [{ id: 'service-store-1', ownerId: 'seller-1' }];
    hasChatted = true;
    services = [{ id: 'service-1', storeId: 'service-store-1' }];
    saved = [];
    ratings = new Map();
    locked = [];

    manager = {
      findOne: jest.fn((entity: unknown, { where }: { where: Where }) => {
        if (entity === ServiceStore) {
          return serviceStores.find((store) => store.id === where.id) ?? null;
        }
        return pending && pending.id === where.id ? { ...pending } : null;
      }),
      // Claims the pending review only while it's still pending; any other
      // update is a receiver's ratings
      update: jest.fn(
        (entity: unknown, where: Where | string, changes: Where) => {
          if (entity !== PendingReview) {
            ratings.set(entity, { id: where, ...changes });
            return { affected: 1 };
          }
          if (!pending || pending.status !== (where as Where).status) {
            return { affected: 0 };
          }
          Object.assign(pending, changes);
          return { affected: 1 };
        },
      ),
      // The receiver's lock, and the count and average of their reviews
      createQueryBuilder: jest.fn((entity: unknown) => {
        const params: Where = {};
        const builder = {
          setLock: () => builder,
          select: () => builder,
          addSelect: () => builder,
          where: (_sql: string, values: Where) => (
            Object.assign(params, values),
            builder
          ),
          andWhere: (_sql: string, values: Where) => (
            Object.assign(params, values),
            builder
          ),
          getOne: () => (locked.push([entity, params.id]), {}),
          getRawOne: () => {
            const rows = saved.filter(
              (r) =>
                r.receiverId === params.receiverId &&
                r.receiverType === params.receiverType,
            );
            const sum = rows.reduce((t, r) => t + Number(r.rating), 0);
            return {
              count: String(rows.length),
              average: rows.length ? String(sum / rows.length) : null,
            };
          },
        };
        return builder;
      }),
      exists: jest.fn((entity: unknown, { where }: { where: Where }) =>
        entity === Conversation
          ? hasChatted
          : entity === Service
            ? matches(services, where)
            : matches(
                entity === ProductStore ? productStores : serviceStores,
                where,
              ),
      ),
      create: jest.fn((_entity: unknown, fields: object) => fields),
      save: jest.fn((fields: Where) => {
        const review = { id: `review-${saved.length + 1}`, ...fields };
        saved.push(review);
        return review;
      }),
      transaction: jest.fn((run: (m: unknown) => unknown) => run(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: getRepositoryToken(Review), useValue: { manager } },
        {
          provide: getRepositoryToken(PendingReview),
          useValue: pendingReviewRepo,
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  it('lists reviews with the factory', async () => {
    (factory.getAll as jest.Mock).mockResolvedValue({ data: [] });

    await expect(service.findAll({ page: '2' })).resolves.toEqual({
      data: [],
    });
    expect(factory.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ manager }),
      { page: '2' },
    );
  });

  it("lists only the pending reviews the user sends, or their stores'", async () => {
    (factory.getAll as jest.Mock).mockResolvedValue({ data: [] });

    await service.findAllPending({ page: '1' }, 'seller-1');
    expect(factory.getAll).toHaveBeenCalledWith(
      pendingReviewRepo,
      { page: '1' },
      { senderId: In(['seller-1', 'store-1', 'service-store-1']) },
    );
  });

  it("lists a user with no stores' own pending reviews only", async () => {
    (factory.getAll as jest.Mock).mockResolvedValue({ data: [] });

    await service.findAllPending({ senderId: 'someone-else' }, 'buyer-1');
    expect(factory.getAll).toHaveBeenCalledWith(
      pendingReviewRepo,
      { senderId: 'someone-else' },
      { senderId: In(['buyer-1']) },
    );
  });

  describe('writing a review', () => {
    it("writes the sender's review and completes the pending one", async () => {
      const result = await write('buyer-1');

      expect(result.data).toMatchObject({
        pendingReviewId: 'pending-1',
        orderId: 'order-1',
        productId: 'product-1',
        serviceId: null,
        senderId: 'buyer-1',
        senderType: ReviewPartyType.USER,
        receiverId: 'seller-1',
        receiverType: ReviewPartyType.USER,
        rating: 5,
        body: 'quick pickup',
      });
      expect(manager.create).toHaveBeenCalledWith(Review, expect.anything());
      expect(pending!.status).toBe(PendingReviewStatus.COMPLETED);
    });

    it('refuses a pending review id that does not exist', async () => {
      await expect(write('buyer-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it("refuses someone who isn't the sender, including the receiver", async () => {
      for (const user of ['seller-1', 'stranger']) {
        await expect(write(user)).rejects.toThrow(ForbiddenException);
      }
      expect(manager.save).not.toHaveBeenCalled();
      expect(pending!.status).toBe(PendingReviewStatus.PENDING);
    });

    it('refuses a second review from the same pending review', async () => {
      await write('buyer-1');

      await expect(write('buyer-1')).rejects.toThrow(ConflictException);
      expect(manager.save).toHaveBeenCalledTimes(1);
    });

    it("lets a store's owner write the store's review", async () => {
      Object.assign(pending!, {
        senderId: 'store-1',
        senderIsStore: true,
        receiverId: 'buyer-1',
        receiverIsStore: false,
      });

      const result = await write('seller-1');

      expect(result.data).toMatchObject({
        senderId: 'store-1',
        senderType: ReviewPartyType.PRODUCT_STORE,
        receiverType: ReviewPartyType.USER,
      });
    });

    it("refuses a store's review from someone who doesn't own the store", async () => {
      Object.assign(pending!, { senderId: 'store-1', senderIsStore: true });

      await expect(write('buyer-1')).rejects.toThrow(ForbiddenException);
    });

    it('works out whether a store receiver is a product or service store', async () => {
      Object.assign(pending!, { receiverId: 'store-1', receiverIsStore: true });
      await expect(write('buyer-1')).resolves.toMatchObject({
        data: { receiverType: ReviewPartyType.PRODUCT_STORE },
      });

      pending!.status = PendingReviewStatus.PENDING;
      Object.assign(pending!, { receiverId: 'service-store-1' });
      await expect(write('buyer-1')).resolves.toMatchObject({
        data: { receiverType: ReviewPartyType.SERVICE_STORE },
      });
    });
  });

  describe('reviewing a service store', () => {
    const review = (userId: string, serviceStoreId = 'service-store-1') =>
      service.create({ serviceStoreId, rating: 4, body: 'clean cut' }, userId);

    it('needs no pending review, only a chat with the store', async () => {
      const result = await review('buyer-1');

      expect(result.data).toMatchObject({
        pendingReviewId: null,
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        senderId: 'buyer-1',
        senderType: ReviewPartyType.USER,
        receiverId: 'service-store-1',
        receiverIsStore: true,
        receiverType: ReviewPartyType.SERVICE_STORE,
        rating: 4,
      });
      expect(manager.update).not.toHaveBeenCalledWith(
        PendingReview,
        expect.anything(),
        expect.anything(),
      );
    });

    it("refuses a store that doesn't exist", async () => {
      await expect(review('buyer-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("refuses the store's owner", async () => {
      await expect(review('seller-1')).rejects.toThrow(
        "You can't review your own store",
      );
    });

    it("refuses someone who hasn't chatted with the store", async () => {
      hasChatted = false;

      await expect(review('buyer-1')).rejects.toThrow(ForbiddenException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('refuses a second review of the same store', async () => {
      manager.save.mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      await expect(review('buyer-1')).rejects.toThrow(ConflictException);
    });

    it('saves the service reviewed, when it is from the store', async () => {
      const result = await service.create(
        {
          serviceStoreId: 'service-store-1',
          serviceId: 'service-1',
          rating: 5,
        },
        'buyer-1',
      );

      expect(result.data).toMatchObject({
        serviceId: 'service-1',
        orderId: null,
        productId: null,
      });
    });

    it('refuses a service from another store', async () => {
      services = [{ id: 'service-1', storeId: 'other-store' }];

      await expect(
        service.create(
          {
            serviceStoreId: 'service-store-1',
            serviceId: 'service-1',
            rating: 5,
          },
          'buyer-1',
        ),
      ).rejects.toThrow('That service is not from this store');
    });

    it('refuses a serviceId on an order review', async () => {
      await expect(
        service.create(
          { pendingReviewId: 'pending-1', serviceId: 'service-1', rating: 5 },
          'buyer-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses both ids at once', async () => {
      await expect(
        service.create(
          {
            pendingReviewId: 'pending-1',
            serviceStoreId: 'service-store-1',
            rating: 4,
          },
          'buyer-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updating the receiver's ratings", () => {
    it("recounts a user's ratings from all their reviews", async () => {
      saved.push(
        {
          receiverId: 'seller-1',
          receiverType: ReviewPartyType.USER,
          rating: 4,
        },
        {
          receiverId: 'seller-1',
          receiverType: ReviewPartyType.USER,
          rating: 4,
        },
        // Someone else's
        { receiverId: 'other', receiverType: ReviewPartyType.USER, rating: 1 },
      );

      await write('buyer-1');

      expect(locked).toEqual([[User, 'seller-1']]);
      expect(ratings.get(User)).toEqual({
        id: 'seller-1',
        ratingsCount: 3,
        ratingsAverage: 4.33,
      });
    });

    it("updates a product store when it's the receiver", async () => {
      Object.assign(pending!, { receiverId: 'store-1', receiverIsStore: true });

      await write('buyer-1');

      expect(ratings.get(ProductStore)).toEqual({
        id: 'store-1',
        ratingsCount: 1,
        ratingsAverage: 5,
      });
      expect(ratings.has(User)).toBe(false);
    });

    it('updates a service store on a service store review', async () => {
      await service.create(
        { serviceStoreId: 'service-store-1', rating: 3 },
        'buyer-1',
      );

      expect(manager.transaction).toHaveBeenCalled();
      expect(ratings.get(ServiceStore)).toEqual({
        id: 'service-store-1',
        ratingsCount: 1,
        ratingsAverage: 3,
      });
    });

    it('leaves the ratings alone when the review is refused', async () => {
      await expect(write('stranger')).rejects.toThrow(ForbiddenException);

      expect(ratings.size).toBe(0);
    });
  });
});

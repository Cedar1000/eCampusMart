import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { OrderRating, RateeType } from './entities/order-rating.entity';
import { Order } from './entities/order.entity';

export interface ReviewQuery {
  page?: string;
  limit?: string;
}

type Party = {
  id: string;
  name: string;
  photo: string | null;
  type: RateeType;
};

// The order ratings, read as reviews: who rated whom, for which item
@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(OrderRating)
    private readonly ratingRepo: Repository<OrderRating>,
  ) {}

  // Reviews of the user and of their product stores, newest first
  async received(userId: string, query: ReviewQuery) {
    return this.page(await this.receivedWhere(userId), query);
  }

  // Reviews the user wrote
  async given(userId: string, query: ReviewQuery) {
    return this.page([{ raterId: userId }], query);
  }

  // The profile's rating: the average and count, and how many of each star
  async summary(userId: string) {
    const rows = await this.ratingRepo
      .createQueryBuilder('rating')
      .select('rating.stars', 'stars')
      .addSelect('COUNT(*)', 'count')
      .where((await this.receivedWhere(userId)).map(toSql).join(' OR '), {
        userId,
        storeIds: await this.storeIds(userId),
        user: RateeType.USER,
        store: RateeType.PRODUCT_STORE,
      })
      .groupBy('rating.stars')
      .getRawMany<{ stars: number; count: string }>();

    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    let total = 0;
    let count = 0;

    for (const row of rows) {
      const stars = Number(row.stars) as 1 | 2 | 3 | 4 | 5;
      const n = Number(row.count);
      breakdown[stars] = n;
      total += stars * n;
      count += n;
    }

    return {
      status: 'success',
      data: {
        userId,
        average: count ? Math.round((total / count) * 10) / 10 : 0,
        count,
        breakdown,
      },
    };
  }

  private async receivedWhere(userId: string) {
    const storeIds = await this.storeIds(userId);

    return [
      { rateeId: userId, rateeType: RateeType.USER },
      ...(storeIds.length
        ? [{ rateeId: In(storeIds), rateeType: RateeType.PRODUCT_STORE }]
        : []),
    ];
  }

  private async storeIds(userId: string) {
    const stores = await this.ratingRepo.manager.find(ProductStore, {
      where: { userId },
      select: ['id'],
    });

    return stores.map(({ id }) => id);
  }

  private async page(
    where: Record<string, unknown>[],
    { page = '1', limit = '10' }: ReviewQuery,
  ) {
    const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const current = Math.max(Number(page) || 1, 1);

    const [ratings, count] = await this.ratingRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (current - 1) * take,
      take,
    });

    const pages = Math.ceil(count / take);

    return {
      status: 'success',
      total: ratings.length,
      count,
      pages,
      currentPage: current,
      nextPage: current < pages ? current + 1 : null,
      prevPage: current > 1 ? current - 1 : null,
      data: await this.withDetails(ratings),
    };
  }

  // Each review with the rater, the rated user or store, and the item ordered
  private async withDetails(ratings: OrderRating[]) {
    if (!ratings.length) return [];

    const manager = this.ratingRepo.manager;
    const userIds = [
      ...new Set(
        ratings.flatMap((r) => [
          r.raterId,
          ...(r.rateeType === RateeType.USER ? [r.rateeId] : []),
        ]),
      ),
    ];
    const storeIds = [
      ...new Set(
        ratings
          .filter((r) => r.rateeType === RateeType.PRODUCT_STORE)
          .map((r) => r.rateeId),
      ),
    ];

    const [users, stores, orders] = await Promise.all([
      manager.find(User, {
        where: { id: In(userIds) },
        select: ['id', 'firstName', 'lastName', 'photo'],
      }),
      storeIds.length
        ? manager.find(ProductStore, {
            where: { id: In(storeIds) },
            select: ['id', 'name', 'logo'],
          })
        : [],
      manager.find(Order, {
        where: { id: In(ratings.map((r) => r.orderId)) },
        select: ['id', 'orderId', 'productId'],
      }),
    ]);
    const products = await manager.find(Product, {
      where: { id: In(orders.map((o) => o.productId)) },
      select: ['id', 'name'],
    });

    const people = new Map<string, Party>(
      users.map((u) => [
        u.id,
        {
          id: u.id,
          name: [u.firstName, u.lastName].filter(Boolean).join(' '),
          photo: u.photo ?? null,
          type: RateeType.USER,
        },
      ]),
    );
    for (const store of stores) {
      people.set(store.id, {
        id: store.id,
        name: store.name ?? '',
        photo: store.logo ?? null,
        type: RateeType.PRODUCT_STORE,
      });
    }
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const productById = new Map(products.map((p) => [p.id, p]));

    return ratings.map((rating) => {
      const order = orderById.get(rating.orderId);
      const product = order && productById.get(order.productId);

      return {
        ...rating,
        rater: people.get(rating.raterId) ?? null,
        ratee: people.get(rating.rateeId) ?? null,
        order: order
          ? {
              id: order.id,
              orderId: order.orderId,
              product: product ? { id: product.id, name: product.name } : null,
            }
          : null,
      };
    });
  }
}

// The same conditions as receivedWhere, for the summary's query builder
const toSql = (where: Record<string, unknown>) =>
  where.rateeType === RateeType.USER
    ? '(rating."rateeId" = :userId AND rating."rateeType" = :user)'
    : '(rating."rateeId" IN (:...storeIds) AND rating."rateeType" = :store)';

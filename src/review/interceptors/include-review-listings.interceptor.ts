import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, mergeMap } from 'rxjs';
import { In, Repository } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import {
  ListingRefs,
  MessageListingsService,
} from 'src/chat/message-listings.service';
import { Order } from 'src/order/entities/order.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { ReviewPartyType } from '../entities/review.entity';

type Row = ListingRefs & {
  orderId?: string | null;
  buyerId: string;
  sellerId: string;
  senderId: string;
  senderIsStore: boolean;
  receiverId: string;
  receiverIsStore: boolean;
};

type ListResponse = {
  data?: Row[];
  [key: string]: unknown;
};

// A user or store, as shown next to a review: a store's photo is its logo
export interface ReviewParty {
  id: string;
  name: string;
  photo: string | null;
  type: ReviewPartyType;
}

const unique = (ids: (string | null | undefined)[]) =>
  [...new Set(ids.filter(Boolean))] as string[];

// Adds to each pending review or review:
// - `product` or `service`: id, name/title, description, price, cover photo,
//   as on chat messages
// - `amount`: the order's amount in naira (null when there's no order)
// - `buyer` and `seller` (users), and `sender` and `receiver` (users or
//   stores), each { id, name, photo, type }
@Injectable()
export class IncludeReviewListingsInterceptor implements NestInterceptor {
  constructor(
    private readonly listings: MessageListingsService,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ListResponse> {
    return next.handle().pipe(
      mergeMap(async (response: ListResponse) => {
        if (!response.data?.length) return response;

        const [rows, amounts, parties] = await Promise.all([
          this.listings.attach(response.data),
          this.orderAmounts(response.data),
          this.parties(response.data),
        ]);
        const party = (id: string) => parties.get(id) ?? null;

        return {
          ...response,
          data: rows.map((row) => ({
            ...row,
            amount: (row.orderId && amounts.get(row.orderId)) ?? null,
            buyer: party(row.buyerId),
            seller: party(row.sellerId),
            sender: party(row.senderId),
            receiver: party(row.receiverId),
          })),
        };
      }),
    );
  }

  // Orders save amounts in kobo; shown in naira like the order responses
  private async orderAmounts(rows: Row[]) {
    const ids = unique(rows.map((row) => row.orderId));

    if (!ids.length) return new Map<string, number>();

    const orders = await this.orderRepo.find({
      where: { id: In(ids) },
      select: ['id', 'amount'],
    });

    return new Map(orders.map(({ id, amount }) => [id, Number(amount) / 100]));
  }

  // Users and stores by id. Ids are UUIDs, so one map holds both
  private async parties(rows: Row[]) {
    const manager = this.orderRepo.manager;
    const userIds = unique(
      rows.flatMap((row) => [
        row.buyerId,
        row.sellerId,
        row.senderIsStore ? null : row.senderId,
        row.receiverIsStore ? null : row.receiverId,
      ]),
    );
    const storeIds = unique(
      rows.flatMap((row) => [
        row.senderIsStore ? row.senderId : null,
        row.receiverIsStore ? row.receiverId : null,
      ]),
    );

    const [users, productStores, serviceStores] = await Promise.all([
      userIds.length
        ? manager.find(User, {
            where: { id: In(userIds) },
            select: ['id', 'firstName', 'lastName', 'photo'],
          })
        : [],
      storeIds.length
        ? manager.find(ProductStore, {
            where: { id: In(storeIds) },
            select: ['id', 'name', 'logo'],
          })
        : [],
      storeIds.length
        ? manager.find(ServiceStore, {
            where: { id: In(storeIds) },
            select: ['id', 'name', 'logo'],
          })
        : [],
    ]);

    const parties = new Map<string, ReviewParty>();

    for (const user of users) {
      parties.set(user.id, {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        photo: user.photo ?? null,
        type: ReviewPartyType.USER,
      });
    }
    for (const store of productStores) {
      parties.set(store.id, {
        id: store.id,
        name: store.name ?? '',
        photo: store.logo ?? null,
        type: ReviewPartyType.PRODUCT_STORE,
      });
    }
    for (const store of serviceStores) {
      parties.set(store.id, {
        id: store.id,
        name: store.name ?? '',
        photo: store.logo ?? null,
        type: ReviewPartyType.SERVICE_STORE,
      });
    }

    return parties;
  }
}

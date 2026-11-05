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
import { Product } from 'src/product/entities/product.entity';
import { ProductStore } from 'src/product-store/entities/product-store.entity';

// Anything with a buyer, a seller and a product, e.g. orders and offers
type PartyRecord = {
  buyerId: string;
  sellerId: string;
  storeId?: string | null;
  productId?: string | null;
};

type PartiesResponse = {
  data?: PartyRecord | PartyRecord[];
  [key: string]: unknown;
};

type PartyUser = Pick<
  User,
  'id' | 'firstName' | 'lastName' | 'photo' | 'ratingsCount' | 'ratingsAverage'
>;

type PartyStore = Pick<
  ProductStore,
  'id' | 'name' | 'logo' | 'ratingsCount' | 'ratingsAverage'
>;

type PartyProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  photo: string | null;
};

// The cover image's url, else the first image's
const coverPhoto = (images?: { url: string; isCoverImage: boolean }[]) =>
  (images?.find((image) => image.isCoverImage) ?? images?.[0])?.url ?? null;

const uniqueIds = (ids: (string | null | undefined)[]) => [
  ...new Set(ids.filter((id): id is string => Boolean(id))),
];

// Adds the buyer, the seller and the product to each record. The seller is the
// product store when the record has a storeId, otherwise the selling user. The
// module using it must register User, ProductStore and Product repositories
@Injectable()
export class IncludePartiesInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ProductStore)
    private readonly storeRepo: Repository<ProductStore>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (response: PartiesResponse) => {
        const responseData = response.data;
        const isList = Array.isArray(responseData);
        const records = isList
          ? responseData
          : responseData
            ? [responseData]
            : [];

        if (!records.length) return response;

        const [users, stores, products] = await Promise.all([
          this.findUsers(
            uniqueIds(
              records.flatMap((r) => [
                r.buyerId,
                r.storeId ? null : r.sellerId,
              ]),
            ),
          ),
          this.findStores(uniqueIds(records.map((r) => r.storeId))),
          this.findProducts(uniqueIds(records.map((r) => r.productId))),
        ]);

        const findSeller = ({ storeId, sellerId }: PartyRecord) => {
          const store = storeId && stores.get(storeId);
          if (store) return { type: 'store', ...store };

          const user = !storeId && users.get(sellerId);
          return user ? { type: 'user', ...user } : null;
        };

        const addParties = (record: PartyRecord) => ({
          ...record,
          buyer: users.get(record.buyerId) ?? null,
          seller: findSeller(record),
          product: record.productId
            ? (products.get(record.productId) ?? null)
            : null,
        });

        return {
          ...response,
          data: isList ? records.map(addParties) : addParties(records[0]),
        };
      }),
    );
  }

  private async findUsers(ids: string[]) {
    if (!ids.length) return new Map<string, PartyUser>();

    const users = await this.userRepo.find({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photo: true,
        ratingsCount: true,
        ratingsAverage: true,
      },
      where: { id: In(ids) },
    });

    return new Map(users.map((user) => [user.id, user as PartyUser]));
  }

  private async findStores(ids: string[]) {
    if (!ids.length) return new Map<string, PartyStore>();

    const stores = await this.storeRepo.find({
      select: {
        id: true,
        name: true,
        logo: true,
        ratingsCount: true,
        ratingsAverage: true,
      },
      where: { id: In(ids) },
    });

    return new Map(stores.map((store) => [store.id, store as PartyStore]));
  }

  private async findProducts(ids: string[]) {
    if (!ids.length) return new Map<string, PartyProduct>();

    const products = await this.productRepo.find({
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: { id: true, url: true, isCoverImage: true },
      },
      relations: { images: true },
      where: { id: In(ids) },
    });

    return new Map(
      products.map((product) => [
        product.id,
        {
          id: product.id,
          name: product.name,
          description: product.description,
          // Numeric columns come back from Postgres as strings
          price: Number(product.price),
          photo: coverPhoto(product.images),
        },
      ]),
    );
  }
}

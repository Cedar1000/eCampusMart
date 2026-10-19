import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, mergeMap } from 'rxjs';
import { In, Repository } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { Service } from 'src/service/entities/service.entity';
import { Housing } from 'src/housing/entities/housing.entity';
import { Message } from '../entities/message.entity';

interface MessageProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  photo: string | null;
}

interface MessageService {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  photo: string | null;
}

interface MessageHousing {
  id: string;
  title: string;
  description: string;
  price: number;
  photo: string | null;
}

type MessageWithListings = Message & {
  product?: MessageProduct | null;
  service?: MessageService | null;
  housing?: MessageHousing | null;
};

type MessagesResponse = {
  data?: Message[];
  [key: string]: unknown;
};

const LISTING_SELECT = {
  id: true,
  description: true,
  price: true,
  images: { id: true, url: true, isCoverImage: true },
} as const;

// The cover image's url, else the first image's
const coverPhoto = (images?: { url: string; isCoverImage: boolean }[]) =>
  (images?.find((image) => image.isCoverImage) ?? images?.[0])?.url ?? null;

const uniqueIds = (ids: (string | undefined)[]) => [
  ...new Set(ids.filter((id): id is string => Boolean(id))),
];

// Adds the product, service or housing (id, name/title, description, price and
// cover photo) to messages that reference one
@Injectable()
export class IncludeMessageListingsInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<MessagesResponse> {
    return next.handle().pipe(
      mergeMap(async (response: MessagesResponse) => {
        const messages = response.data ?? [];

        const productIds = uniqueIds(messages.map((m) => m.productId));
        const serviceIds = uniqueIds(messages.map((m) => m.serviceId));
        const housingIds = uniqueIds(messages.map((m) => m.housingId));

        if (!productIds.length && !serviceIds.length && !housingIds.length) {
          return response;
        }

        const [products, services, housings] = await Promise.all([
          this.findProducts(productIds),
          this.findServices(serviceIds),
          this.findHousings(housingIds),
        ]);

        return {
          ...response,
          data: messages.map((message): MessageWithListings => {
            const { productId, serviceId, housingId } = message;

            return {
              ...message,
              ...(productId && { product: products.get(productId) ?? null }),
              ...(serviceId && { service: services.get(serviceId) ?? null }),
              ...(housingId && { housing: housings.get(housingId) ?? null }),
            };
          }),
        };
      }),
    );
  }

  private async findProducts(ids: string[]) {
    if (!ids.length) return new Map<string, MessageProduct>();

    const products = await this.productRepo.find({
      where: { id: In(ids) },
      relations: ['images'],
      select: { ...LISTING_SELECT, name: true },
    });

    return new Map<string, MessageProduct>(
      products.map(({ id, name, description, price, images }) => [
        id,
        { id, name, description, price, photo: coverPhoto(images) },
      ]),
    );
  }

  private async findServices(ids: string[]) {
    if (!ids.length) return new Map<string, MessageService>();

    const services = await this.serviceRepo.find({
      where: { id: In(ids) },
      relations: ['images'],
      select: { ...LISTING_SELECT, title: true },
    });

    return new Map<string, MessageService>(
      services.map(({ id, title, description, price, images }) => [
        id,
        { id, title, description, price, photo: coverPhoto(images) },
      ]),
    );
  }

  private async findHousings(ids: string[]) {
    if (!ids.length) return new Map<string, MessageHousing>();

    const housings = await this.housingRepo.find({
      where: { id: In(ids) },
      relations: ['images'],
      select: { ...LISTING_SELECT, title: true },
    });

    return new Map<string, MessageHousing>(
      housings.map(({ id, title, description, price, images }) => [
        id,
        { id, title, description, price, photo: coverPhoto(images) },
      ]),
    );
  }
}

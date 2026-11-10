import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { Service } from 'src/service/entities/service.entity';
import { Housing } from 'src/housing/entities/housing.entity';
import { Offer } from 'src/offer/entities/offer.entity';
import { Message } from './entities/message.entity';

export interface MessageProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  photo: string | null;
}

export interface MessageService {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  photo: string | null;
}

export interface MessageHousing {
  id: string;
  title: string;
  description: string;
  price: number;
  photo: string | null;
}

// Anything that points at a listing or offer: chat messages, pending reviews
export interface ListingRefs {
  productId?: string | null;
  serviceId?: string | null;
  housingId?: string | null;
  offerId?: string | null;
}

export interface ListingSummaries {
  product?: MessageProduct | null;
  service?: MessageService | null;
  housing?: MessageHousing | null;
  offer?: Offer | null;
}

export type MessageWithListings = Message & ListingSummaries;

const LISTING_SELECT = {
  id: true,
  description: true,
  price: true,
  images: { id: true, url: true, isCoverImage: true },
} as const;

// The cover image's url, else the first image's
const coverPhoto = (images?: { url: string; isCoverImage: boolean }[]) =>
  (images?.find((image) => image.isCoverImage) ?? images?.[0])?.url ?? null;

const uniqueIds = (ids: (string | null | undefined)[]) => [
  ...new Set(ids.filter((id): id is string => Boolean(id))),
];

// Adds the product, service or housing (id, name/title, description, price and
// cover photo) to messages that reference one, and the offer to offer messages.
// Used by GET messages and by the new-message event, so both look the same,
// and by the review lists
@Injectable()
export class MessageListingsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Housing)
    private readonly housingRepo: Repository<Housing>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
  ) {}

  async attach<T extends ListingRefs>(
    messages: T[],
  ): Promise<(T & ListingSummaries)[]> {
    const productIds = uniqueIds(messages.map((m) => m.productId));
    const serviceIds = uniqueIds(messages.map((m) => m.serviceId));
    const housingIds = uniqueIds(messages.map((m) => m.housingId));
    const offerIds = uniqueIds(messages.map((m) => m.offerId));

    if (
      !productIds.length &&
      !serviceIds.length &&
      !housingIds.length &&
      !offerIds.length
    ) {
      return messages;
    }

    const [products, services, housings, offers] = await Promise.all([
      this.findProducts(productIds),
      this.findServices(serviceIds),
      this.findHousings(housingIds),
      this.findOffers(offerIds),
    ]);

    return messages.map((message) => {
      const { productId, serviceId, housingId, offerId } = message;

      return {
        ...message,
        ...(productId && { product: products.get(productId) ?? null }),
        ...(serviceId && { service: services.get(serviceId) ?? null }),
        ...(housingId && { housing: housings.get(housingId) ?? null }),
        ...(offerId && { offer: offers.get(offerId) ?? null }),
      };
    });
  }

  // Amounts are stored in kobo and shown in naira, as on the new-message event
  private async findOffers(ids: string[]) {
    if (!ids.length) return new Map<string, Offer>();

    const offers = await this.offerRepo.find({ where: { id: In(ids) } });

    return new Map<string, Offer>(
      offers.map((offer) => [
        offer.id,
        { ...offer, amount: offer.amount / 100 } as Offer,
      ]),
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

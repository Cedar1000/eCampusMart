import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { OrderService } from 'src/order/order.service';
import { ProductStore } from 'src/product-store/entities/product-store.entity';
import { ServiceStore } from 'src/service-store/entities/service-store.entity';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { Offer, OfferSellerType, OfferStatus } from './entities/offer.entity';
import { OfferGateway } from './offer.gateway';
import { PushService } from 'src/notification/push.service';
import { Product } from 'src/product/entities/product.entity';

@Injectable()
export class OfferService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,

    private readonly orderService: OrderService,

    private readonly offerGateway: OfferGateway,

    private readonly pushService: PushService,
  ) {}

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.offerRepo, query);
  }

  findOne(id: number) {
    return `This action returns a #${id} offer`;
  }

  // The buyer accepts or rejects an offer and the seller cancels it, only while
  // it's pending and unexpired. Accepting orders one unit at the offer's amount.
  // Both sides hear about every change on `offer-updated`
  async update(id: string, updateOfferDto: UpdateOfferDto, userId: string) {
    const { status } = updateOfferDto;
    const offer = await this.offerRepo.findOneBy({ id });

    if (!offer) throw new NotFoundException('No resource with that ID');

    const allowed =
      status === OfferStatus.CANCELLED
        ? (await this.findSellerUserId(offer)) === userId
        : offer.buyerId === userId;

    if (!allowed) {
      throw new ForbiddenException(
        status === OfferStatus.CANCELLED
          ? 'Only the seller can cancel this offer'
          : 'Only the buyer can answer this offer',
      );
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(`This offer is already ${offer.status}`);
    }

    if (offer.expiresAt <= new Date()) {
      await this.setStatus(offer, OfferStatus.EXPIRED, userId);
      throw new BadRequestException('This offer has expired');
    }

    if (status !== OfferStatus.ACCEPTED) {
      return await this.setStatus(offer, status, userId);
    }

    // Refuses with 409 if the product is no longer available
    const order = await this.orderService.create(
      { productId: offer.productId },
      userId,
      offer,
    );

    const updated = await this.setStatus(offer, status, userId);

    return {
      ...updated,
      data: { ...updated.data, order: (order as { data: unknown }).data },
    };
  }

  // Saves the status, tells both sides on the socket, pushes it to whoever
  // didn't make the change (`actorId`), and returns the offer in naira
  private async setStatus(offer: Offer, status: OfferStatus, actorId: string) {
    const updated = await factory.updateOne(this.offerRepo, offer.id, {
      status,
    });
    const saved = updated.data as Offer;

    await this.offerGateway.notify(saved);
    await this.pushStatus(saved, actorId);

    return { ...updated, data: { ...saved, amount: saved.amount / 100 } };
  }

  // Never throws, like PushService.send
  private async pushStatus(offer: Offer, actorId: string) {
    try {
      const sellerUserId = await this.findSellerUserId(offer);
      const userIds = [offer.buyerId, sellerUserId].filter(
        (id): id is string => !!id && id !== actorId,
      );
      if (!userIds.length) return;

      const product = await this.offerRepo.manager.findOne(Product, {
        where: { id: offer.productId },
        select: ['id', 'name'],
      });

      const what = `₦${(offer.amount / 100).toLocaleString('en-NG')} offer for ${product?.name ?? 'a product'}`;
      const messages: Partial<Record<OfferStatus, [string, string]>> = {
        [OfferStatus.ACCEPTED]: ['Offer accepted', `Your ${what} was accepted`],
        [OfferStatus.REJECTED]: ['Offer declined', `Your ${what} was declined`],
        [OfferStatus.CANCELLED]: [
          'Offer withdrawn',
          `The ${what} was withdrawn`,
        ],
        [OfferStatus.EXPIRED]: ['Offer expired', `The ${what} has expired`],
      };
      const message = messages[offer.status];
      if (!message) return;

      await this.pushService.send(userIds, {
        title: message[0],
        body: message[1],
        data: {
          type: 'offer-updated',
          offerId: offer.id,
          status: offer.status,
        },
      });
    } catch (error) {
      console.error('Offer push failed', offer.id, error);
    }
  }

  // The user who sold: the selling user, or the owner of the selling store
  private async findSellerUserId(offer: Offer) {
    const { manager } = this.offerRepo;

    switch (offer.sellerType) {
      case OfferSellerType.PRODUCT_STORE: {
        const store = await manager.findOne(ProductStore, {
          where: { id: offer.sellerId },
          select: ['id', 'userId'],
        });
        return store?.userId ?? null;
      }
      case OfferSellerType.SERVICE_STORE: {
        const store = await manager.findOne(ServiceStore, {
          where: { id: offer.sellerId },
          select: ['id', 'ownerId'],
        });
        return store?.ownerId ?? null;
      }
      default:
        return offer.sellerId;
    }
  }
}

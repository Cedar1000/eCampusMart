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

@Injectable()
export class OfferService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,

    private readonly orderService: OrderService,

    private readonly offerGateway: OfferGateway,
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
        ? await this.isSeller(offer, userId)
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
      await this.setStatus(offer, OfferStatus.EXPIRED);
      throw new BadRequestException('This offer has expired');
    }

    if (status !== OfferStatus.ACCEPTED) {
      return await this.setStatus(offer, status);
    }

    // Refuses with 409 if the product is no longer available
    const order = await this.orderService.create(
      { productId: offer.productId },
      userId,
      offer,
    );

    const updated = await this.setStatus(offer, status);

    return {
      ...updated,
      data: { ...updated.data, order: (order as { data: unknown }).data },
    };
  }

  // Saves the status, tells both sides, and returns the offer in naira
  private async setStatus(offer: Offer, status: OfferStatus) {
    const updated = await factory.updateOne(this.offerRepo, offer.id, {
      status,
    });
    const saved = updated.data as Offer;

    await this.offerGateway.notify(saved);

    return { ...updated, data: { ...saved, amount: saved.amount / 100 } };
  }

  // The seller is a user, or a product or service store the user owns
  private async isSeller(offer: Offer, userId: string) {
    const { manager } = this.offerRepo;

    switch (offer.sellerType) {
      case OfferSellerType.PRODUCT_STORE:
        return manager.exists(ProductStore, {
          where: { id: offer.sellerId, userId },
        });
      case OfferSellerType.SERVICE_STORE:
        return manager.exists(ServiceStore, {
          where: { id: offer.sellerId, ownerId: userId },
        });
      default:
        return offer.sellerId === userId;
    }
  }
}

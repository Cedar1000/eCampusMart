import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import IQuery from 'interfaces/query.Interface';
import * as factory from 'utils/handlerFactory';
import { OrderService } from 'src/order/order.service';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { Offer, OfferStatus } from './entities/offer.entity';

@Injectable()
export class OfferService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,

    private readonly orderService: OrderService,
  ) {}

  async findAll(query: Partial<IQuery>) {
    return await factory.getAll(this.offerRepo, query);
  }

  findOne(id: number) {
    return `This action returns a #${id} offer`;
  }

  // Only the buyer answers an offer, and only while it's pending and unexpired.
  // Accepting orders the product at the offer's amount, then expires the other
  // pending offers on that product
  async update(id: string, updateOfferDto: UpdateOfferDto, userId: string) {
    const offer = await this.offerRepo.findOneBy({ id });

    if (!offer) throw new NotFoundException('No resource with that ID');

    if (offer.buyerId !== userId) {
      throw new ForbiddenException('This offer is not yours');
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(`This offer is already ${offer.status}`);
    }

    if (offer.expiresAt <= new Date()) {
      await factory.updateOne(this.offerRepo, id, {
        status: OfferStatus.EXPIRED,
      });

      throw new BadRequestException('This offer has expired');
    }

    if (updateOfferDto.status === OfferStatus.REJECTED) {
      return await factory.updateOne(this.offerRepo, id, updateOfferDto);
    }

    // Refuses with 409 if the product was ordered or sold in the meantime
    const order = await this.orderService.create(
      { productId: offer.productId },
      userId,
      offer,
    );

    const updated = await factory.updateOne(this.offerRepo, id, updateOfferDto);

    await this.offerRepo.update(
      {
        productId: offer.productId,
        status: OfferStatus.PENDING,
        id: Not(id),
      },
      { status: OfferStatus.EXPIRED_BY_ACCEPTANCE },
    );

    return {
      ...updated,
      data: {
        ...(updated.data as Offer),
        order: (order as { data: unknown }).data,
      },
    };
  }
}

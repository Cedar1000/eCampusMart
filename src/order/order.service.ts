import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as QRCode from 'qrcode';
import { Repository } from 'typeorm';

import { Offer } from 'src/offer/entities/offer.entity';
import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';

import IQuery from 'interfaces/query.Interface';
import { uploadToCloudinary } from 'utils/cloudinary';
import * as factory from 'utils/handlerFactory';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, OrderParty } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderGateway } from './order.gateway';
import { takeStock } from './order-stock';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    private readonly orderGateway: OrderGateway,
  ) {}

  // The seller, store and price come from the product, and the buyer is the
  // logged-in user. Placing an order leaves the product's stock alone: the
  // units are only taken when it's completed. An accepted offer sets the amount
  async create(
    createOrderDto: CreateOrderDto,
    buyerId: string,
    offer?: Pick<Offer, 'id' | 'amount'>,
  ) {
    const { productId, metadata, quantity = 1 } = createOrderDto;

    const product = await this.orderRepo.manager.findOne(Product, {
      where: { id: productId },
      select: [
        'id',
        'userId',
        'storeId',
        'isStoreProduct',
        'price',
        'quantity',
        'status',
      ],
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.userId === buyerId) {
      throw new BadRequestException("You can't order your own product");
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new ConflictException('This product is no longer available');
    }

    if (product.quantity < quantity) {
      throw new ConflictException(
        `Only ${product.quantity} of this product left`,
      );
    }

    const created = await factory.createOne(this.orderRepo, {
      productId,
      buyerId,
      sellerId: product.userId,
      isStoreOrder: product.isStoreProduct,
      storeId: product.isStoreProduct ? product.storeId : undefined,
      offerId: offer?.id,
      quantity,
      // Offers are already kobo; product prices are naira per unit (numeric,
      // read as a string)
      amount:
        offer?.amount ?? Math.round(Number(product.price) * 100) * quantity,
      metadata,
    });

    // The QR holds just the order id, which the app sends to
    // PATCH /orders/:id/complete
    const order = created.data as Order;
    try {
      const image = await QRCode.toDataURL(order.id, { width: 512, margin: 2 });
      order.qrCode = await uploadToCloudinary(image, 'orders', order.id);
      await this.orderRepo.update(order.id, { qrCode: order.qrCode });
    } catch (error) {
      this.logger.error(`QR code for order ${order.id} failed`, error);
    }

    await this.orderGateway.notify(order, 'placed', buyerId);

    return { ...created, data: { ...order, amount: order.amount / 100 } };
  }

  // Leaves out the orders this side deleted (see remove)
  async findAll(query: IQuery, side: OrderParty, userId: string) {
    return await factory.getAll(
      this.orderRepo,
      query,
      side === 'seller'
        ? { sellerId: userId, hiddenBySeller: false }
        : { buyerId: userId, hiddenByBuyer: false },
    );
  }

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }

  // Only the order's buyer or seller can change it
  async update(id: string, updateOrderDto: UpdateOrderDto, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      select: ['id', 'buyerId', 'sellerId'],
    });

    if (!order) throw new NotFoundException('No resource with that ID');

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('This order is not yours');
    }

    return await factory.updateOne(this.orderRepo, id, updateOrderDto);
  }

  // Cancelling leaves the product alone; completing takes the order's units
  // from its stock
  async cancel(id: string, userId: string) {
    return await this.close(id, userId, OrderStatus.CANCELLED);
  }

  async complete(id: string, userId: string) {
    return await this.close(id, userId, OrderStatus.COMPLETED);
  }

  // Only the order's buyer or seller can close it, and only while it's pending
  private async close(
    id: string,
    userId: string,
    status: OrderStatus.CANCELLED | OrderStatus.COMPLETED,
  ) {
    const closed = await this.orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });

      if (!order) throw new NotFoundException('No resource with that ID');

      if (order.buyerId !== userId && order.sellerId !== userId) {
        throw new ForbiddenException('This order is not yours');
      }

      const now = new Date();
      const role: OrderParty = order.buyerId === userId ? 'buyer' : 'seller';
      const changes: Partial<Order> =
        status === OrderStatus.COMPLETED
          ? { status, completedAt: now }
          : {
              status,
              cancelledAt: now,
              cancelledByRole: role,
              cancelledBy:
                role === 'seller' && order.isStoreOrder && order.storeId
                  ? order.storeId
                  : userId,
            };

      // Conditional, so a cancel and a complete at once can't both go through
      const closed = await manager
        .createQueryBuilder()
        .update(Order)
        .set(changes)
        .where('id = :id AND status = :pending', {
          id,
          pending: OrderStatus.PENDING,
        })
        .execute();

      if (!closed.affected) {
        throw new BadRequestException(`This order is already ${order.status}`);
      }

      if (status === OrderStatus.COMPLETED) {
        await takeStock(manager, order.productId, order.quantity);
      }

      return {
        status: 'success',
        message: 'update successful!',
        data: { ...order, ...changes },
      };
    });

    await this.orderGateway.notify(
      closed.data,
      status === OrderStatus.CANCELLED ? 'cancelled' : 'completed',
      userId,
    );

    // Saved in kobo; shown in naira like the other order responses
    return {
      ...closed,
      data: { ...closed.data, amount: Number(closed.data.amount) / 100 },
    };
  }

  // Hides an expired order from the caller's list; the other side still sees it
  async remove(id: string, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      select: ['id', 'buyerId', 'sellerId', 'status'],
    });

    if (!order) throw new NotFoundException('No resource with that ID');

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('This order is not yours');
    }

    if (order.status !== OrderStatus.EXPIRED) {
      throw new BadRequestException('Only an expired order can be deleted');
    }

    await this.orderRepo.update(
      id,
      order.sellerId === userId
        ? { hiddenBySeller: true }
        : { hiddenByBuyer: true },
    );
  }
}

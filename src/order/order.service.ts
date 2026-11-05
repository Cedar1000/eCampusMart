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
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  // The seller, store and amount come from the product, and the buyer is the
  // logged-in user. Ordering takes the product off sale (active -> ordered).
  // An accepted offer sets the amount instead of the product's price
  async create(
    createOrderDto: CreateOrderDto,
    buyerId: string,
    offer?: Pick<Offer, 'id' | 'amount'>,
  ) {
    const { productId, metadata } = createOrderDto;

    const created = await this.orderRepo.manager.transaction(
      async (manager) => {
        const product = await manager.findOne(Product, {
          where: { id: productId },
          select: ['id', 'userId', 'storeId', 'isStoreProduct', 'price'],
        });

        if (!product) throw new NotFoundException('Product not found');

        if (product.userId === buyerId) {
          throw new BadRequestException("You can't order your own product");
        }

        // Conditional, so two buyers ordering at once can't both get it
        const taken = await manager
          .createQueryBuilder()
          .update(Product)
          .set({ status: ProductStatus.ORDERED })
          .where('id = :productId AND status = :active', {
            productId,
            active: ProductStatus.ACTIVE,
          })
          .execute();

        if (!taken.affected) {
          throw new ConflictException('This product is no longer available');
        }

        const repo = manager.getRepository(Order);

        return await factory.createOne(repo, {
          productId,
          buyerId,
          sellerId: product.userId,
          isStoreOrder: product.isStoreProduct,
          storeId: product.isStoreProduct ? product.storeId : undefined,
          offerId: offer?.id,
          // Offers are already kobo; product prices are naira (numeric, read
          // as a string)
          amount: offer?.amount ?? Math.round(Number(product.price) * 100),
          metadata,
        });
      },
    );

    // After the commit, so a slow upload doesn't hold the product row. The QR
    // holds just the order id, which the app sends to PATCH /orders/:id/complete
    const order = created.data as Order;
    try {
      const image = await QRCode.toDataURL(order.id, { width: 512, margin: 2 });
      order.qrCode = await uploadToCloudinary(image, 'orders', order.id);
      await this.orderRepo.update(order.id, { qrCode: order.qrCode });
    } catch (error) {
      this.logger.error(`QR code for order ${order.id} failed`, error);
    }

    return created;
  }

  async findAll(query: IQuery & { sellerId?: string; buyerId?: string }) {
    return await factory.getAll(this.orderRepo, query);
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

  // Cancelling puts the product back on sale; completing marks it sold
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
    return await this.orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });

      if (!order) throw new NotFoundException('No resource with that ID');

      if (order.buyerId !== userId && order.sellerId !== userId) {
        throw new ForbiddenException('This order is not yours');
      }

      // Conditional, so a cancel and a complete at once can't both go through
      const closed = await manager
        .createQueryBuilder()
        .update(Order)
        .set({ status })
        .where('id = :id AND status = :pending', {
          id,
          pending: OrderStatus.PENDING,
        })
        .execute();

      if (!closed.affected) {
        throw new BadRequestException(`This order is already ${order.status}`);
      }

      await manager
        .createQueryBuilder()
        .update(Product)
        .set({
          status:
            status === OrderStatus.CANCELLED
              ? ProductStatus.ACTIVE
              : ProductStatus.SOLD,
        })
        .where('id = :productId AND status = :ordered', {
          productId: order.productId,
          ordered: ProductStatus.ORDERED,
        })
        .execute();

      return {
        status: 'success',
        message: 'update successful!',
        data: { ...order, status },
      };
    });
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}

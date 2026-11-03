import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { ProductStatus } from 'src/product/enums/product-status.enum';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';

// Pending orders past their expiresAt become expired, and any product still held
// as ordered without a pending or completed order goes back on sale
@Injectable()
export class OrderExpirySweep {
  private readonly logger = new Logger(OrderExpirySweep.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    try {
      await this.orderRepo.manager.transaction(async (manager) => {
        const expired = await manager
          .createQueryBuilder()
          .update(Order)
          .set({ status: OrderStatus.EXPIRED })
          .where('status = :pending AND "expiresAt" < now()', {
            pending: OrderStatus.PENDING,
          })
          .execute();

        // Order.productId is a varchar and Product.id a uuid, hence the cast
        const released = await manager
          .createQueryBuilder()
          .update(Product)
          .set({ status: ProductStatus.ACTIVE })
          .where('status = :ordered', { ordered: ProductStatus.ORDERED })
          .andWhere(
            `id::text NOT IN (SELECT o."productId" FROM "order" o WHERE o.status IN (:...open))`,
            { open: [OrderStatus.PENDING, OrderStatus.COMPLETED] },
          )
          .execute();

        if (expired.affected || released.affected) {
          this.logger.log(
            `Expired ${expired.affected ?? 0} orders, released ${released.affected ?? 0} products`,
          );
        }
      });
    } catch (error) {
      this.logger.error('Order expiry sweep failed', error as Error);
    }
  }
}

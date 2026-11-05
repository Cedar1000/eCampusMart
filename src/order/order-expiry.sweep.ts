import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderGateway } from './order.gateway';
import { restock } from './order-stock';

// Pending orders past their expiresAt become expired, and their units go back to
// the product's stock
@Injectable()
export class OrderExpirySweep {
  private readonly logger = new Logger(OrderExpirySweep.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    private readonly orderGateway: OrderGateway,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    try {
      const orders = await this.orderRepo.manager.transaction(
        async (manager) => {
          const expired = await manager
            .createQueryBuilder()
            .update(Order)
            .set({ status: OrderStatus.EXPIRED })
            .where('status = :pending AND "expiresAt" < now()', {
              pending: OrderStatus.PENDING,
            })
            .returning('*')
            .execute();

          const orders = expired.raw as Order[];

          for (const { productId, quantity } of orders) {
            await restock(manager, productId, quantity);
          }

          if (orders.length) {
            this.logger.log(
              `Expired ${orders.length} orders and restocked them`,
            );
          }

          return orders;
        },
      );

      // After the commit, so nobody hears about an expiry that was rolled back
      for (const order of orders) {
        await this.orderGateway.notify(order, 'expired');
      }
    } catch (error) {
      this.logger.error('Order expiry sweep failed', error as Error);
    }
  }
}

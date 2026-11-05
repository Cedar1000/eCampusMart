import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderGateway } from './order.gateway';

// Pending orders past their expiresAt become expired. Their units were never
// taken from the product, so it's left alone
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
      const expired = await this.orderRepo
        .createQueryBuilder()
        .update(Order)
        .set({ status: OrderStatus.EXPIRED })
        .where('status = :pending AND "expiresAt" < now()', {
          pending: OrderStatus.PENDING,
        })
        .returning('*')
        .execute();

      const orders = expired.raw as Order[];

      if (orders.length) this.logger.log(`Expired ${orders.length} orders`);

      for (const order of orders) {
        await this.orderGateway.notify(order, 'expired');
      }
    } catch (error) {
      this.logger.error('Order expiry sweep failed', error as Error);
    }
  }
}

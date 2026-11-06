import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';

import { Order } from '../entities/order.entity';
import { OrderRatingService } from '../order-rating.service';

type OrderResponse = {
  data?: Order | Order[];
  [key: string]: unknown;
};

// Adds both sides' ratings to each order: { buyer, seller }, null where that
// side hasn't rated yet
@Injectable()
export class IncludeOrderRatingsInterceptor implements NestInterceptor {
  constructor(private readonly orderRatingService: OrderRatingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (response: OrderResponse) => {
        const responseData = response.data;
        if (!responseData) return response;

        const orders = Array.isArray(responseData)
          ? responseData
          : [responseData];
        const ratings = await this.orderRatingService.findRatings(
          orders.map(({ id }) => id),
        );
        const withRatings = (order: Order) => ({
          ...order,
          ratings: ratings[order.id],
        });

        return {
          ...response,
          data: Array.isArray(responseData)
            ? orders.map(withRatings)
            : withRatings(responseData),
        };
      }),
    );
  }
}

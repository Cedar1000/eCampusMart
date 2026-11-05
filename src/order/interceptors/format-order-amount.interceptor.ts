import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { Order } from '../entities/order.entity';

type OrderResponse = {
  data?: Order | Order[];
  [key: string]: unknown;
};

// Orders store kobo; clients are shown naira
const formatOrder = (order: Order) => ({
  ...order,
  amount: Number(order.amount) / 100,
});

@Injectable()
export class FormatOrderAmountInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((response: OrderResponse) => {
        const responseData = response.data;

        if (!responseData) return response;

        return {
          ...response,
          data: Array.isArray(responseData)
            ? responseData.map(formatOrder)
            : formatOrder(responseData),
        };
      }),
    );
  }
}

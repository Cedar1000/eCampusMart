import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { Transaction } from '../entities/transaction.entity';

type ProductResponse = {
  data?: Transaction | Transaction[];
  [key: string]: unknown;
};

@Injectable()
export class FormatAmountInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ProductResponse> {
    return next.handle().pipe(
      map((response: ProductResponse) => {
        const responseData = response.data;

        if (!responseData) return response;

        if (Array.isArray(responseData)) {
          return {
            ...response,
            data: responseData.map((transaction) => ({
              ...transaction,
              amount: transaction.amount / 100,
            })),
          };
        }

        return {
          ...response,
          data: {
            ...responseData,
            amount: responseData.amount / 100,
          },
        };
      }),
    );
  }
}

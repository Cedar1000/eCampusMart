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

// Numeric columns come back from Postgres as strings, and balances are null on older rows
const toNaira = (kobo?: number | string | null) =>
  kobo === null || kobo === undefined ? kobo : Number(kobo) / 100;

const formatTransaction = (transaction: Transaction) => ({
  ...transaction,
  amount: Number(transaction.amount) / 100,
  beforeBalance: toNaira(transaction.beforeBalance),
  afterBalance: toNaira(transaction.afterBalance),
});

@Injectable()
export class FormatAmountInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((response: ProductResponse) => {
        const responseData = response.data;

        if (!responseData) return response;

        return {
          ...response,
          data: Array.isArray(responseData)
            ? responseData.map(formatTransaction)
            : formatTransaction(responseData),
        };
      }),
    );
  }
}

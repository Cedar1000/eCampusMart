import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Campus } from 'src/campus/entities/campus.entity';
import { ProductStore } from '../entities/product-store.entity';

type ProductResponse = {
  data?: ProductStore | ProductStore[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeCampusInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Campus)
    private readonly campusRepo: Repository<Campus>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ProductResponse> {
    return next.handle().pipe(
      mergeMap(async (response: ProductResponse) => {
        const responseData = response.data;

        if (!responseData) return response;

        if (Array.isArray(responseData)) {
          const data = await Promise.all(
            responseData.map(async (store: ProductStore) => {
              const campus = await this.campusRepo.findOneBy({
                id: store.campusId,
              });

              return { ...store, campus };
            }),
          );

          return { ...response, data };
        }

        const campus = await this.campusRepo.findOneBy({
          id: responseData.campusId,
        });

        return {
          ...response,
          data: { ...responseData, campus },
        };
      }),
    );
  }
}

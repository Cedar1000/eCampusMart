import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, mergeMap } from 'rxjs';
import { In, Repository } from 'typeorm';

import { User } from 'src/auth/entities/user.entity';
import { Product } from '../entities/product.entity';

type ProductResponse = {
  data?: Product | Product[];
  [key: string]: unknown;
};

type ProductUser = Pick<
  User,
  'firstName' | 'lastName' | 'photo' | 'ratingsCount' | 'ratingsAverage'
>;

@Injectable()
export class ProductUserDetailsInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (response: ProductResponse) => {
        const responseData = response.data;
        const isProductList = Array.isArray(responseData);
        const products: Product[] = isProductList
          ? responseData
          : responseData
            ? [responseData]
            : [];

        const userIds = [
          ...new Set(products.map((product) => product.userId).filter(Boolean)),
        ];

        if (!userIds.length) return response;

        const users = await this.userRepo.find({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photo: true,
            ratingsCount: true,
            ratingsAverage: true,
          },
          where: { id: In(userIds) },
        });

        const usersById = new Map(
          users.map(({ id, ...user }) => [id, user as ProductUser]),
        );
        const addUserDetails = (product: Product) => ({
          ...product,
          user: usersById.get(product.userId) ?? null,
        });

        return {
          ...response,
          data: isProductList
            ? products.map(addUserDetails)
            : addUserDetails(products[0]),
        };
      }),
    );
  }
}

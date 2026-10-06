import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, mergeMap } from 'rxjs';
import { In, Repository } from 'typeorm';

import { Product } from 'src/product/entities/product.entity';
import { ProductFavourite } from '../entities/product-favourite.entity';

type FavouriteWithProduct = ProductFavourite & {
  product?: Product | null;
};

type ProductFavouriteResponse = {
  data?: ProductFavourite | ProductFavourite[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeFavouriteProductInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ProductFavouriteResponse> {
    return next.handle().pipe(
      mergeMap(async (response: ProductFavouriteResponse) => {
        const responseData = response.data;
        const isFavouriteList = Array.isArray(responseData);
        const favourites = isFavouriteList
          ? responseData
          : responseData
            ? [responseData]
            : [];

        const productIds = [
          ...new Set(
            favourites
              .map((favourite) => favourite.productId)
              .filter((productId): productId is string => Boolean(productId)),
          ),
        ];

        if (!productIds.length) return response;

        const products = await this.productRepo.find({
          where: { id: In(productIds) },
          relations: ['images'],
        });

        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );

        const addProduct = (
          favourite: ProductFavourite,
        ): FavouriteWithProduct => ({
          ...favourite,
          product: favourite.productId
            ? (productsById.get(favourite.productId) ?? null)
            : null,
        });

        return {
          ...response,
          data: isFavouriteList
            ? favourites.map(addProduct)
            : addProduct(favourites[0]),
        };
      }),
    );
  }
}

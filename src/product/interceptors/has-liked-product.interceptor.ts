import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { Response } from 'express';

import { RedisService } from 'src/redis/redis.service';
import { ProductImage } from '../entities/product-image.entity';

type Product = {
  id: string;
  images: ProductImage[];
  [key: string]: unknown;
};

type ProductResponse = {
  data?: Product | Product[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeIsLikedInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ProductResponse> {
    const response = context
      .switchToHttp()
      .getResponse<Response & { locals: { user?: { id: string } } }>();

    const userId = response.locals.user?.id;

    return next.handle().pipe(
      mergeMap(async (response: ProductResponse) => {
        const responseData = response.data;

        if (!responseData) return response;
        if (!userId) {
          const withIsLiked = (product: Product) => ({
            ...product,
            isLiked: false,
          });

          return {
            ...response,
            data: Array.isArray(responseData)
              ? responseData.map(withIsLiked)
              : withIsLiked(responseData),
          };
        }

        const redisKey = `user:${userId}:liked-products`;

        // Multiple posts
        if (Array.isArray(responseData)) {
          const postIds = responseData.map((post) => post.id);

          let liked: any[];

          if (!postIds.length) {
            liked = [];
          } else {
            liked = await this.redisService.smismember(redisKey, postIds);
          }

          return {
            ...response,
            data: responseData.map((product: Product, index) => ({
              ...product,

              images: product.images.sort(
                (a, b) => Number(b.isCoverImage) - Number(a.isCoverImage),
              ),
              isLiked: Boolean(liked[index]),
            })),
          };
        }

        // Single post
        const [isLiked] = await this.redisService.smismember(redisKey, [
          responseData.id,
        ]);

        return {
          ...response,
          data: {
            ...responseData,
            isLiked: Boolean(isLiked),
            images: responseData.images.sort(
              (a, b) => Number(b.isCoverImage) - Number(a.isCoverImage),
            ),
          },
        };
      }),
    );
  }
}

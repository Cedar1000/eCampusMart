import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { Response } from 'express';

import { RedisService } from 'src/redis/redis.service';
import { HousingImage } from 'src/housing/entities/housing-image.entity';

type Housing = {
  id: string;
  images: HousingImage[];
  [key: string]: unknown;
};

type HousingResponse = {
  data?: Housing | Housing[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeIsLikedInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<HousingResponse> {
    const response = context
      .switchToHttp()
      .getResponse<Response & { locals: { user?: { id: string } } }>();

    const userId = response.locals.user?.id;

    return next.handle().pipe(
      mergeMap(async (response: HousingResponse) => {
        const responseData = response.data;

        if (!responseData) return response;

        const sortImages = (images: HousingImage[] = []) =>
          [...images].sort(
            (a, b) => Number(b.isCoverImage) - Number(a.isCoverImage),
          );

        if (!userId) {
          const withIsLiked = (housing: Housing) => ({
            ...housing,
            isLiked: false,
          });

          return {
            ...response,
            data: Array.isArray(responseData)
              ? responseData.map(withIsLiked)
              : withIsLiked(responseData),
          };
        }

        const redisKey = `user:${userId}:liked-housing`;

        // Multiple housings
        if (Array.isArray(responseData)) {
          const housingIds = responseData.map((housing) => housing.id);

          let liked: unknown[];

          if (!housingIds.length) {
            liked = [];
          } else {
            liked = await this.redisService.smismember(redisKey, housingIds);
          }

          return {
            ...response,
            data: responseData.map((housing: Housing, index) => ({
              ...housing,
              images: sortImages(housing.images),
              isLiked: Boolean(liked[index]),
            })),
          };
        }

        // Single housing
        const [isLiked] = await this.redisService.smismember(redisKey, [
          responseData.id,
        ]);

        return {
          ...response,
          data: {
            ...responseData,
            isLiked: Boolean(isLiked),
            images: sortImages(responseData.images),
          },
        };
      }),
    );
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { Response } from 'express';

import { RedisService } from 'src/redis/redis.service';

type Post = {
  id: string;
  [key: string]: unknown;
};

type PostResponse = {
  data?: Post | Post[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeIsLikedInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<PostResponse> {
    const response = context
      .switchToHttp()
      .getResponse<Response & { locals: { user?: { id: string } } }>();

    const userId = response.locals.user?.id;

    return next.handle().pipe(
      mergeMap(async (response: PostResponse) => {
        const responseData = response.data;

        if (!responseData) return response;
        if (!userId) {
          const withIsLiked = (product: Post) => ({
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

          const liked = await this.redisService.smismember(redisKey, postIds);

          return {
            ...response,
            data: responseData.map((product, index) => ({
              ...product,
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
          data: { ...responseData, isLiked: Boolean(isLiked) },
        };
      }),
    );
  }
}

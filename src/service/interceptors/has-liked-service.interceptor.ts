import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, mergeMap } from 'rxjs';

import { RedisService } from 'src/redis/redis.service';

type Service = {
  id: string;
  [key: string]: unknown;
};

type ServiceResponse = {
  data?: Service | Service[];
  [key: string]: unknown;
};

@Injectable()
export class IncludeIsLikedServiceInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ServiceResponse> {
    const response = context
      .switchToHttp()
      .getResponse<Response & { locals: { user?: { id: string } } }>();

    const userId = response.locals.user?.id;

    return next.handle().pipe(
      mergeMap(async (response: ServiceResponse) => {
        const responseData = response.data;

        if (!responseData) return response;
        if (!userId) {
          const withIsLiked = (service: Service) => ({
            ...service,
            isLiked: false,
          });

          return {
            ...response,
            data: Array.isArray(responseData)
              ? responseData.map(withIsLiked)
              : withIsLiked(responseData),
          };
        }

        const redisKey = `user:${userId}:liked-services`;

        if (Array.isArray(responseData)) {
          const serviceIds = responseData.map((service) => service.id);

          const liked = await this.redisService.smismember(
            redisKey,
            serviceIds,
          );

          return {
            ...response,
            data: responseData.map((service, index) => ({
              ...service,
              isLiked: Boolean(liked[index]),
            })),
          };
        }

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

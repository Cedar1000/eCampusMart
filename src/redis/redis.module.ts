import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

import { RedisService } from './redis.service';

import { REDIS_CLIENT } from './constants/redis.constant';
import { getRedisOptions } from './redis.config';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        return new Redis({
          ...getRedisOptions(),
          maxRetriesPerRequest: 3,

          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 200, 1000);
          },
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}

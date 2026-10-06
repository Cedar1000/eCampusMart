import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

import { RedisService } from './redis.service';

import { REDIS_CLIENT } from './constants/redis.constant';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}

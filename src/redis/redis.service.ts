import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './constants/redis.constant';

@Injectable()
export class RedisService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async has(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async set(key: string, value: string, ttl?: number) {
    if (ttl) {
      await this.redis.set(key, value, 'EX', ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  async delete(key: string) {
    await this.redis.del(key);
  }

  async sadd(key: string, value: string) {
    return await this.redis.sadd(key, value);
  }

  async srem(key: string, value: string) {
    await this.redis.srem(key, value);
  }

  async smismember(key: string, values: string[]) {
    return this.redis.smismember(key, values);
  }
}

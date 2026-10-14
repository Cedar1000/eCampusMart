import { RedisOptions } from 'ioredis';

// Upstash provides a rediss:// URL (TLS); local development can keep host/port/password
export const getRedisOptions = (): RedisOptions => {
  const url = process.env.REDIS_URL;

  if (url) {
    const { protocol, hostname, port, username, password } = new URL(url);

    return {
      host: hostname,
      port: Number(port || 6379),
      username: decodeURIComponent(username) || undefined,
      password: decodeURIComponent(password) || undefined,
      tls: protocol === 'rediss:' ? {} : undefined,
    };
  }

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  };
};

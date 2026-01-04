import { CacheModuleOptions } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

const DEFAULT_TTL = 5 * 60_000; // 5 minutes
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export const getCacheConfig = (): CacheModuleOptions => {
  const redisUrl = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;

  return {
    stores: [createKeyv(redisUrl)],
    ttl: process.env.CACHE_TTL ? Number(process.env.CACHE_TTL) : DEFAULT_TTL,
  };
};

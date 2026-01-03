import { CacheModuleOptions } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

export const getCacheConfig = (): CacheModuleOptions => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return {
    stores: [createKeyv(redisUrl)],
    ttl: process.env.CACHE_TTL ? Number(process.env.CACHE_TTL) : 5 * 60_000, // 5 minutes
  };
};
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { redisClient } from './cache/cache.config';

type ServiceStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const health: HealthResponse = {
      status: database === 'up' && redis === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
    };

    if (health.status === 'error') {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    try {
      await redisClient.set('health-check', 'ok', 1000);
      const value = await redisClient.get('health-check');
      await redisClient.delete('health-check');

      return value === 'ok' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}

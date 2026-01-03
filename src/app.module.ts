import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from '@nestjs/cache-manager';
import { getCacheConfig } from './cache/cache.config';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: getCacheConfig,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

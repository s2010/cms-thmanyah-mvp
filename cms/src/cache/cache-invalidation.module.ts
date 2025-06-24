import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheInvalidationService } from './cache-invalidation.service';

// Cache Invalidation Module
//   Handles Redis pub/sub events for invalidating Discovery service caches.
//   Maintains the microservice communication pattern from the system design.
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'CACHE_INVALIDATION_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            retryAttempts: 5,
            retryDelay: 3000,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [CacheInvalidationService],
  exports: [CacheInvalidationService],
})
export class CacheInvalidationModule {} 
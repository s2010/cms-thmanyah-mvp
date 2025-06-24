import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Content } from './entities/content.entity';
import { ContentController } from './content.controller';
import { ContentDiscoveryBusinessService } from './domain/content-discovery-business.service';
import { TypeOrmContentDiscoveryRepository } from './infrastructure/typeorm-content-discovery.repository';
import { RedisCacheManager } from './infrastructure/redis-cache.manager';

// Content Discovery Module
//   Orchestrates all content discovery functionality.
//   Follows Dependency Inversion Principle with proper interface bindings.
//   Optimized for read-only operations and high performance.
@Module({
  imports: [
    TypeOrmModule.forFeature([Content]),
    ConfigModule,
  ],
  controllers: [ContentController],
  providers: [
    // Business logic service
    ContentDiscoveryBusinessService,
    
    // Repository implementation (follows Dependency Inversion)
    {
      provide: 'IContentDiscoveryRepository',
      useClass: TypeOrmContentDiscoveryRepository,
    },
    
    // Redis cache manager implementation (as per system design)
    {
      provide: 'IContentCacheManager',
      useClass: RedisCacheManager,
    },
    
    // Direct provider binding for services that need concrete classes
    TypeOrmContentDiscoveryRepository,
  ],
  exports: [
    ContentDiscoveryBusinessService,
    'IContentDiscoveryRepository',
    'IContentCacheManager',
  ],
})
export class ContentModule {} 
import { Module } from '@nestjs/common';
import { CacheInvalidationService } from './cache-invalidation.service';
import { ContentModule } from '../content/content.module';

/**
 * Cache Invalidation Module
 * 
 * Handles Redis pub/sub for cache invalidation across the discovery service.
 * Depends on ContentModule to access business services for cache management.
 */
@Module({
  imports: [ContentModule],
  providers: [CacheInvalidationService],
  exports: [CacheInvalidationService],
})
export class CacheInvalidationModule {} 
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

// Cache invalidation via Redis pub/sub
// Sends events to Discovery service when content changes
// IMPORTANT: Cache failures shouldn't break content operations!
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject('CACHE_INVALIDATION_SERVICE')
    private readonly redisClient: ClientProxy,
  ) {}

  // Notify Discovery service about content changes
  async publishContentUpdated(contentId: number, action: 'created' | 'updated' | 'published' | 'unpublished'): Promise<void> {
    try {
      const eventData = {
        contentId,
        action,
        timestamp: new Date().toISOString(),
      };

      await this.redisClient.emit('content-updated', eventData);
      
      this.logger.debug(`Published content update event: ID ${contentId}, action: ${action}`);
    } catch (error: any) {
      this.logger.error(`Failed to publish content update event: ${error?.message || 'Unknown error'}`, error?.stack);
    }
  }

  // Tell Discovery service content was deleted
  async publishContentDeleted(contentId: number): Promise<void> {
    try {
      const eventData = {
        contentId,
        timestamp: new Date().toISOString(),
      };

      await this.redisClient.emit('content-deleted', eventData);
      
      this.logger.debug(`Published content deletion event: ID ${contentId}`);
    } catch (error: any) {
      this.logger.error(`Failed to publish content deletion event: ${error?.message || 'Unknown error'}`, error?.stack);
    }
  }

  // Publish bulk content invalidation event
  async publishBulkContentInvalidation(): Promise<void> {
    try {
      const eventData = {
        timestamp: new Date().toISOString(),
      };

      await this.redisClient.emit('content-bulk-updated', eventData);
      
      this.logger.debug('Published bulk content invalidation event');
    } catch (error: any) {
      this.logger.error(`Failed to publish bulk content invalidation event: ${error?.message || 'Unknown error'}`, error?.stack);
    }
  }

  // Publish YouTube sync completion event
  async publishYouTubeSyncCompleted(syncedCount: number, newContent: number[]): Promise<void> {
    try {
      // If new content was created, publish individual events
      if (newContent.length > 0) {
        const publishPromises = newContent.map(contentId => 
          this.publishContentUpdated(contentId, 'created')
        );
        
        await Promise.allSettled(publishPromises);
      }

      // Also publish bulk invalidation for list caches
      if (syncedCount > 0) {
        await this.publishBulkContentInvalidation();
      }

      this.logger.debug(`Published YouTube sync events: ${syncedCount} synced, ${newContent.length} new`);
    } catch (error: any) {
      this.logger.error(`Failed to publish YouTube sync events: ${error?.message || 'Unknown error'}`, error?.stack);
    }
  }

  // Health check for Redis connection
  async healthCheck(): Promise<{ connected: boolean; error?: string }> {
    try {
      // Simple ping test
      await this.redisClient.send({ cmd: 'ping' }, {}).toPromise();
      return { connected: true };
    } catch (error: any) {
      return { 
        connected: false, 
        error: error?.message || 'Connection failed'
      };
    }
  }
} 
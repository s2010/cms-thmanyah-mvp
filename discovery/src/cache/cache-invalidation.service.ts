import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ContentDiscoveryBusinessService } from '../content/domain/content-discovery-business.service';

/**
 * Cache Invalidation Service
 * 
 * Handles Redis pub/sub events for cache invalidation.
 * Listens for content updates from the CMS monolith and invalidates relevant caches.
 * Follows the Observer pattern for decoupled event handling.
 */
@Injectable()
export class CacheInvalidationService implements OnModuleInit {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject('CACHE_INVALIDATION_SERVICE')
    private readonly redisClient: ClientProxy,
    private readonly contentService: ContentDiscoveryBusinessService,
  ) {}

  async onModuleInit() {
    await this.setupEventListeners();
  }

  /**
   * Set up Redis pub/sub event listeners
   */
  private async setupEventListeners(): Promise<void> {
    try {
      // Listen for content update events from CMS
      this.redisClient.connect();
      
      // Subscribe to content invalidation events
      this.subscribeToContentEvents();
      
      this.logger.log('Cache invalidation service initialized and listening for events');
    } catch (error) {
      this.logger.error(`Failed to setup cache invalidation listeners: ${error.message}`, error.stack);
    }
  }

  /**
   * Subscribe to content-related cache invalidation events
   */
  private subscribeToContentEvents(): void {
    // Listen for specific content updates
    this.redisClient
      .send<any>({ cmd: 'content-updated' }, {})
      .subscribe({
        next: (data) => this.handleContentUpdated(data),
        error: (error) => this.logger.error(`Content update event error: ${error.message}`),
      });

    // Listen for bulk content invalidation
    this.redisClient
      .send<any>({ cmd: 'content-bulk-updated' }, {})
      .subscribe({
        next: () => this.handleBulkContentInvalidation(),
        error: (error) => this.logger.error(`Bulk content update event error: ${error.message}`),
      });

    // Listen for content deletion events
    this.redisClient
      .send<any>({ cmd: 'content-deleted' }, {})
      .subscribe({
        next: (data) => this.handleContentDeleted(data),
        error: (error) => this.logger.error(`Content deletion event error: ${error.message}`),
      });
  }

  /**
   * Handle individual content update events
   */
  private async handleContentUpdated(eventData: { contentId: number; action: string }): Promise<void> {
    try {
      const { contentId, action } = eventData;
      
      this.logger.debug(`Received content update event: ID ${contentId}, action: ${action}`);
      
      // Invalidate specific content and related caches
      await this.contentService.invalidateContentCache(contentId);
      
      this.logger.debug(`Successfully invalidated cache for content: ${contentId}`);
    } catch (error) {
      this.logger.error(`Failed to handle content update event: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle bulk content invalidation (e.g., after bulk operations)
   */
  private async handleBulkContentInvalidation(): Promise<void> {
    try {
      this.logger.debug('Received bulk content invalidation event');
      
      // Invalidate all content-related caches
      await this.contentService.invalidateContentCache();
      
      this.logger.debug('Successfully handled bulk cache invalidation');
    } catch (error) {
      this.logger.error(`Failed to handle bulk content invalidation: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle content deletion events
   */
  private async handleContentDeleted(eventData: { contentId: number }): Promise<void> {
    try {
      const { contentId } = eventData;
      
      this.logger.debug(`Received content deletion event: ID ${contentId}`);
      
      // Invalidate all caches since content lists will change
      await this.contentService.invalidateContentCache();
      
      this.logger.debug(`Successfully handled content deletion: ${contentId}`);
    } catch (error) {
      this.logger.error(`Failed to handle content deletion event: ${error.message}`, error.stack);
    }
  }

  /**
   * Manually trigger cache invalidation (for testing or admin purposes)
   */
  async manualCacheInvalidation(contentId?: number): Promise<void> {
    try {
      await this.contentService.invalidateContentCache(contentId);
      this.logger.log(`Manual cache invalidation completed${contentId ? ` for content: ${contentId}` : ''}`);
    } catch (error) {
      this.logger.error(`Manual cache invalidation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Health check for cache invalidation service
   */
  async healthCheck(): Promise<{ status: string; connected: boolean }> {
    try {
      // Simple ping to check Redis connection
      // Note: This is a simplified health check
      return {
        status: 'healthy',
        connected: true,
      };
    } catch (error) {
      this.logger.warn(`Cache invalidation health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        connected: false,
      };
    }
  }
} 
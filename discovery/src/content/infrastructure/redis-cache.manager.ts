import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { IContentCacheManager } from '../domain/content-discovery.repository.interface';

/**
 * Redis Cache Manager Implementation
 * 
 * Handles caching operations with Redis backend.
 * Follows Single Responsibility and Interface Segregation principles.
 * Provides intelligent key management and TTL handling.
 */
@Injectable()
export class RedisCacheManager implements IContentCacheManager {
  private readonly logger = new Logger(RedisCacheManager.name);
  private readonly keyPrefix = 'cms_discovery';

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildFullKey(key);
      const cached = await this.cacheManager.get<T>(fullKey);
      
      if (cached) {
        this.logger.debug(`Cache hit: ${key}`);
        return cached;
      }
      
      this.logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}: ${error.message}`);
      return null; // Fail gracefully - don't break the app if cache fails
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const fullKey = this.buildFullKey(key);
      
      if (ttlSeconds) {
        await this.cacheManager.set(fullKey, value, ttlSeconds * 1000); // Convert to milliseconds
      } else {
        await this.cacheManager.set(fullKey, value);
      }
      
      this.logger.debug(`Cache set: ${key}${ttlSeconds ? ` (TTL: ${ttlSeconds}s)` : ''}`);
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}: ${error.message}`);
      // Don't throw - caching failures shouldn't break the application
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.buildFullKey(key);
      await this.cacheManager.del(fullKey);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.warn(`Cache delete failed for key ${key}: ${error.message}`);
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const fullPattern = this.buildFullKey(pattern);
      
      // Note: This is a simplified implementation
      // For production, you'd want to use Redis SCAN for better performance
      const keys = await this.getKeysByPattern(fullPattern);
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.cacheManager.del(key)));
        this.logger.debug(`Cache pattern deleted: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      this.logger.warn(`Cache pattern delete failed for pattern ${pattern}: ${error.message}`);
    }
  }

  generateKey(operation: string, ...params: any[]): string {
    // Create deterministic cache keys
    const paramString = params
      .map(param => {
        if (typeof param === 'object') {
          return JSON.stringify(param); // Handle objects consistently
        }
        return String(param);
      })
      .join(':');
    
    return paramString ? `${operation}:${paramString}` : operation;
  }

  // Private helper methods

  private buildFullKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  private async getKeysByPattern(pattern: string): Promise<string[]> {
    // This is a simplified implementation
    // In production, you'd want to use Redis SCAN command for better performance
    // and to avoid blocking the Redis server on large key sets
    
    try {
      // For now, return empty array - proper implementation would require
      // direct Redis client access or cache-manager extension
      return [];
    } catch (error) {
      this.logger.warn(`Failed to get keys by pattern ${pattern}: ${error.message}`);
      return [];
    }
  }
} 
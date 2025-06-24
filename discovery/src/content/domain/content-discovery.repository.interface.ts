import { Content } from '../entities/content.entity';

/**
 * Content Discovery Repository Interface
 * 
 * Abstracts data access for discovery operations.
 * Follows Repository Pattern and Interface Segregation Principle.
 */

export interface ContentListResult {
  data: Content[];
  total: number;
  page: number;
  lastPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ContentSearchResult extends ContentListResult {
  query: string;
  searchTime: number; // Search execution time in ms
}

export interface IContentDiscoveryRepository {
  /**
   * Find published content with pagination
   */
  findPublishedContent(page: number, limit: number): Promise<ContentListResult>;

  /**
   * Find a single published content item by ID
   */
  findPublishedById(id: number): Promise<Content | null>;

  /**
   * Search published content by text query
   */
  searchPublishedContent(query: string, page: number, limit: number): Promise<ContentSearchResult>;

  /**
   * Get latest published content for feeds
   */
  getLatestPublished(limit: number): Promise<Content[]>;

  /**
   * Check if content exists and is published
   */
  isContentPublished(id: number): Promise<boolean>;
}

/**
 * Cache Management Interface
 * 
 * Separates caching concerns from data access.
 * Follows Single Responsibility Principle.
 */
export interface IContentCacheManager {
  /**
   * Get cached content by key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set cached content with TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete cached content by key
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple cached items by pattern
   */
  deleteByPattern(pattern: string): Promise<void>;

  /**
   * Generate cache key for content operations
   */
  generateKey(operation: string, ...params: any[]): string;
} 
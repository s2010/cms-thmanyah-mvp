import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, IsNull } from 'typeorm';
import { 
  IContentDiscoveryRepository,
  ContentListResult,
  ContentSearchResult
} from '../domain/content-discovery.repository.interface';
import { Content } from '../entities/content.entity';

// Content discovery repo - read-only queries for public API
// NOTE: This hits the postgres read replica, so data might be ~2sec behind
// TODO: Add query caching based on https://30dayscoding.com/blog/caching-in-content-management-systems-cms
@Injectable()
export class TypeOrmContentDiscoveryRepository implements IContentDiscoveryRepository {
  private readonly logger = new Logger(TypeOrmContentDiscoveryRepository.name);

  constructor(
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
  ) {}

  // Only select fields we actually need - saves memory and query time
  private getContentSelectFields(): (keyof Content)[] {
    return [
      'id',
      'title', 
      'body',
      'thumbnailUrl',
      'videoUrl',
      'publishedAt',
      'createdAt'
    ];
  }

  async findPaginated(page: number, limit: number): Promise<{ content: Content[]; total: number }> {
    try {
      const [content, total] = await this.contentRepository.findAndCount({
        where: { isPublished: true },
        select: this.getContentSelectFields(),
        order: { publishedAt: 'DESC', createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      
      return { content, total };
    } catch (error) {
      this.logger.error(`Failed to find paginated content: ${(error as Error).message}`, (error as Error).stack);
      throw new Error('Content discovery query failed');
    }
  }

  async findBySearchQuery(query: string, page: number, limit: number): Promise<{ content: Content[]; total: number }> {
    try {
      const [content, total] = await this.contentRepository.findAndCount({
        where: [
          { title: ILike(`%${query}%`), isPublished: true },
          { body: ILike(`%${query}%`), isPublished: true }
        ],
        select: this.getContentSelectFields(),
        order: { publishedAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      
      return { content, total };
    } catch (error) {
      this.logger.error(`Failed to search content with query "${query}": ${(error as Error).message}`, (error as Error).stack);
      throw new Error('Content search query failed');
    }
  }

  async findById(id: number): Promise<Content | null> {
    try {
      const content = await this.contentRepository.findOne({
        where: { id, isPublished: true },
        select: this.getContentSelectFields(),
      });
      
      return content;
    } catch (error) {
      this.logger.error(`Failed to find content by ID ${id}: ${(error as Error).message}`, (error as Error).stack);
      return null;
    }
  }

  async findLatest(limit: number): Promise<Content[]> {
    try {
      const content = await this.contentRepository.find({
        where: { isPublished: true },
        select: this.getContentSelectFields(),
        order: { publishedAt: 'DESC', createdAt: 'DESC' },
        take: limit,
      });
      
      return content;
    } catch (error) {
      this.logger.error(`Failed to find latest content: ${(error as Error).message}`, (error as Error).stack);
      throw new Error('Latest content query failed');
    }
  }

  async getContentCount(): Promise<number> {
    try {
      return await this.contentRepository.count({
        where: { isPublished: true }
      });
    } catch (error) {
      this.logger.error(`Failed to get content count: ${(error as Error).message}`, (error as Error).stack);
      return 0;
    }
  }

  async findPublishedContent(page: number, limit: number): Promise<ContentListResult> {
    try {
      const [data, total] = await this.contentRepository.findAndCount({
        where: this.getPublishedContentFilter(),
        order: { publishedAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
        select: this.getContentSelectFields(),
      });

      return this.buildContentListResult(data, total, page, limit);
    } catch (error) {
      this.logger.error(`Failed to find published content: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  async findPublishedById(id: number): Promise<Content | null> {
    try {
      return await this.contentRepository.findOne({
        where: { 
          id, 
          ...this.getPublishedContentFilter()
        },
        select: this.getContentSelectFields(),
      });
    } catch (error) {
      this.logger.error(`Failed to find published content by ID ${id}: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  async searchPublishedContent(query: string, page: number, limit: number): Promise<ContentSearchResult> {
    const startTime = Date.now();
    
    try {
      const searchTerm = `%${query.toLowerCase()}%`;
      
      const [data, total] = await this.contentRepository.findAndCount({
        where: [
          { 
            ...this.getPublishedContentFilter(),
            title: ILike(searchTerm)
          },
          { 
            ...this.getPublishedContentFilter(),
            body: ILike(searchTerm)
          }
        ],
        order: { 
          publishedAt: 'DESC',
          title: 'ASC' 
        },
        skip: (page - 1) * limit,
        take: limit,
        select: this.getContentSelectFields(),
      });

      const searchTime = Date.now() - startTime;
      const listResult = this.buildContentListResult(data, total, page, limit);

      return {
        ...listResult,
        query,
        searchTime,
      };
    } catch (error) {
      this.logger.error(`Failed to search published content for "${query}": ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  async getLatestPublished(limit: number): Promise<Content[]> {
    try {
      return await this.contentRepository.find({
        where: this.getPublishedContentFilter(),
        order: { publishedAt: 'DESC' },
        take: limit,
        select: this.getContentSelectFields(),
      });
    } catch (error) {
      this.logger.error(`Failed to get latest published content: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  async isContentPublished(id: number): Promise<boolean> {
    try {
      const exists = await this.contentRepository.exist({
        where: {
          id,
          ...this.getPublishedContentFilter()
        }
      });
      
      return exists;
    } catch (error) {
      this.logger.error(`Failed to check if content ${id} is published: ${(error as Error).message}`, (error as Error).stack);
      return false;
    }
  }

  // Private helper methods

  // Standard published content filter - keeps queries consistent
  private getPublishedContentFilter() {
    return {
      isPublished: true,
      publishedAt: Not(IsNull()),
    };
  }

  // Helper to build paginated response with all the metadata
  private buildContentListResult(
    data: Content[], 
    total: number, 
    page: number, 
    limit: number
  ): ContentListResult {
    const lastPage = Math.ceil(total / limit);
    
    return {
      data,
      total,
      page,
      lastPage,
      hasNext: page < lastPage,
      hasPrevious: page > 1,
    };
  }
} 
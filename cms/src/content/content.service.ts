import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { Content } from './content.entity';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ContentBusinessRulesService } from './business/content-business-rules.service';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import { IContentRepository } from './domain/content-repository.interface';
import { ContentValidationService } from './domain/content-validation.service';

export interface ContentSyncResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

// Main CMS content service - handles all the CRUD stuff for episodes
// NOTE: Most content comes from YouTube sync, but admins can also upload manually
// WARN: Publishing workflow has issues with episodes >3hrs 
// TODO: Auto-transcription for Arabic episodes 
@Injectable()
export class ContentService {
  private readonly logger = new Logger('ContentSvc');

  constructor(
    @Inject('IContentRepository') private readonly contentRepository: IContentRepository,
    private readonly businessRules: ContentBusinessRulesService,
    private readonly cacheInvalidation: CacheInvalidationService,
    private readonly validationService: ContentValidationService,
  ) {}

  async createContent(dto: CreateContentDto): Promise<Content> {
    this.businessRules.validate(dto);
    
    try {
      const savedContent = await this.contentRepository.create(dto);
      
      await this.cacheInvalidation.publishContentUpdated(savedContent.id, 'created');
      
      this.logger.log(`Episode created: "${savedContent.title}" (ID: ${savedContent.id})`);
      return savedContent;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Episode creation failed: ${msg}`);
      throw new BadRequestException(`Failed to create episode: ${msg}`);
    }
  }

  async updateContent(id: number, dto: UpdateContentDto): Promise<Content> {
    this.logger.debug(`Update started for content ${id} with YouTube ID: ${dto.youtubeId}`);
    
    const existing = await this.findContentById(id);
    this.logger.debug(`Found existing content: "${existing.title}"`);
    
    this.logger.debug(`Calling validation service...`);
    await this.validationService.validateUpdateConstraints(id, dto);
    this.logger.debug(`Validation passed, proceeding to business rules...`);
    
    this.businessRules.validateForUpdate(existing, dto);
    this.logger.debug(`Business rules passed, proceeding to repository update...`);
    
             try {
      const updated = await this.contentRepository.update(id, dto);
        
      const action = this.determineCacheAction(existing, dto);
      await this.cacheInvalidation.publishContentUpdated(updated.id, action);
        
      this.logger.log(`Episode updated: "${updated.title}" (${id}) - ${action}`);
      return updated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown update error';
      this.logger.error(`Update failed for episode ${id}: ${msg}`);
      throw new BadRequestException({
        message: 'Failed to update episode',
        originalError: msg,
        code: 'UPDATE_FAILED'
      });
    }
  }

  async removeContent(id: number): Promise<void> {
    const content = await this.findContentById(id);
    
    if (!this.businessRules.canDelete(content)) {
      throw new BadRequestException('Cannot delete recently published episode - contact admin');
    }
    
    if (content.isPublished) {
      this.logger.warn(`Deleting published episode: "${content.title}" (${id})`);
    }
    
    await this.contentRepository.remove(content.id);
    
    await this.cacheInvalidation.publishContentDeleted(content.id);
    
    this.logger.log(`Episode deleted: ${id} - "${content.title}"`);
  }

  async findContentById(id: number): Promise<Content> {
    const content = await this.contentRepository.findById(id);
    
    if (!content) {
      throw new NotFoundException(`Content ${id} not found`);
    }
    
    return content;
  }

  // Admin content list with pagination - sorted by newest first  
  async findAll(page: number = 1, limit: number = 20): Promise<{
    data: Content[];
    total: number;
    page: number;
    lastPage: number;
  }> {
    const result = await this.contentRepository.findAll(page, limit);
    const lastPage = Math.ceil(result.total / limit);
    
    this.logger.debug(`Loaded ${result.data.length} episodes (page ${page}/${lastPage})`);
    
    return {
      data: result.data,
      total: result.total,
      page,
      lastPage,
    };
  }

  async upsertVideoContent(dto: CreateContentDto): Promise<Content> {
    if (!dto.youtubeId) {
      throw new BadRequestException('YouTube ID is required for synchronization');
    }

    const existing = await this.contentRepository.findByYoutubeId(dto.youtubeId);

    if (existing) {
      const needsUpdate = this.hasSignificantChanges(existing, dto);
      if (needsUpdate) {
        this.logger.debug(`Updating YouTube content: "${existing.title}"`);
        return this.updateContent(existing.id, dto);
      }
      
      this.logger.debug(`Skipping update for: "${existing.title}" (no changes)`);
      return existing;
    }

    this.logger.log(`Creating new content from YouTube: "${dto.title}"`);
    return this.createContent(dto);
  }

  async bulkUpsertYoutubeContent(contents: CreateContentDto[]): Promise<ContentSyncResult> {
    this.logger.log(`Bulk syncing ${contents.length} items from YouTube`);
    
    const results = await this.batchUpsertVideoContent(contents);
    
    this.logger.log(`Bulk sync complete: ${results.processed} items processed`);
    return results;
  }

  private isPublicationStatusChanged(existing: Content, dto: UpdateContentDto): boolean {
    return existing.isPublished !== dto.isPublished;
  }

  private determineCacheAction(
    existing: Content, 
    dto: UpdateContentDto
  ): 'updated' | 'published' | 'unpublished' {
    if (existing.isPublished && dto.isPublished === false) {
      return 'unpublished';
    }
    if (!existing.isPublished && dto.isPublished === true) {
      return 'published';
    }
    return 'updated';
  }

  private hasSignificantChanges(existing: Content, dto: CreateContentDto): boolean {
    return existing.title !== dto.title ||
           existing.body !== dto.body ||
           existing.thumbnailUrl !== dto.thumbnailUrl;
  }

  // Bulk video processing for YouTube sync - this can take a while
  async batchUpsertVideoContent(videos: CreateContentDto[]): Promise<ContentSyncResult> {
    this.logger.log(`Batch upserting ${videos.length} videos`);

    const result: ContentSyncResult = {
      success: true,
      processed: 0,
      created: 0,
      updated: 0,
      errors: []
    };

    const newContentIds: number[] = [];

    for (const videoDto of videos) {
      try {
        const existing = videoDto.youtubeId 
          ? await this.contentRepository.findByYoutubeId(videoDto.youtubeId)
          : null;

        if (existing) {
          await this.updateContent(existing.id, videoDto);
          result.updated++;
        } else {
          const newContent = await this.createContent(videoDto);
          newContentIds.push(newContent.id);
          result.created++;
        }
        
        result.processed++;
      } catch (error: any) {
        result.errors.push(`Failed to sync video "${videoDto.title}": ${error.message}`);
        result.success = false;
      }
    }
    
    if (result.processed > 0) {
      try {
        await this.cacheInvalidation.publishYouTubeSyncCompleted(result.processed, newContentIds);
      } catch (cacheError) {
        const msg = cacheError instanceof Error ? cacheError.message : 'Unknown cache error';
        this.logger.warn(`Cache notification failed: ${msg}`);
      }
    }
    
    this.logger.log(`Batch sync done: ${result.processed} processed, ${result.created} new, ${result.updated} updated, ${result.errors.length} failed`);
    
    if (result.errors.length > 0) {
      this.logger.warn(`Sync errors: ${result.errors.slice(0, 3).join('; ')}${result.errors.length > 3 ? '...' : ''}`);
    }
    
    return result;
  }
} 
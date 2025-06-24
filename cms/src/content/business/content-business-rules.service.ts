import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateContentDto } from '../dto/create-content.dto';
import { UpdateContentDto } from '../dto/update-content.dto';
import { Content } from '../content.entity';


@Injectable()
export class ContentBusinessRulesService {
  
  validate(dto: CreateContentDto): void {
    this.validateContentStructure(dto);
    this.validatePublishingRules(dto);
  }

  validateForUpdate(existing: Content, dto: UpdateContentDto): void {
    this.validateContentStructure(dto);
    this.validateUpdateSpecificRules(existing, dto);
  }

  canDelete(content: Content): boolean {
    // Allow deletion of unpublished content or content older than 1 hour
    if (!content.isPublished) {
      return true;
    }
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return content.publishedAt && content.publishedAt < oneHourAgo;
  }

  private validateContentStructure(dto: CreateContentDto | UpdateContentDto): void {
    // Basic structure validation without restrictive word counts
    if (dto.title && dto.title.trim().length === 0) {
      throw new BadRequestException('Title cannot be empty');
    }

    if (dto.body && dto.body.trim().length === 0) {
      throw new BadRequestException('Content body cannot be empty');
    }

    // YouTube URL validation if provided
    if (dto.videoUrl && !this.isValidYouTubeUrl(dto.videoUrl)) {
      throw new BadRequestException('Invalid YouTube URL format');
    }
  }

  private validatePublishingRules(dto: CreateContentDto | UpdateContentDto): void {
    // Publishing-specific business rules
    if (dto.isPublished && (!dto.title || !dto.body)) {
      throw new BadRequestException('Published content must have both title and body');
    }

    // Ensure published content has proper metadata
    if (dto.isPublished && dto.publishedAt) {
      const publishDate = typeof dto.publishedAt === 'string' 
        ? new Date(dto.publishedAt) 
        : dto.publishedAt;
      
      if (publishDate > new Date()) {
        throw new BadRequestException('Cannot publish content with future date');
      }
    }
  }

  private validateUpdateSpecificRules(existing: Content, dto: UpdateContentDto): void {
    // Prevent unpublishing if content has been live for more than 24 hours
    if (existing.isPublished && dto.isPublished === false) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (existing.publishedAt && existing.publishedAt < twentyFourHoursAgo) {
        throw new BadRequestException('Cannot unpublish content that has been live for more than 24 hours');
      }
    }
  }

  private isValidYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  }
} 
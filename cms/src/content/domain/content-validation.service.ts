import { Injectable, BadRequestException, Inject, Logger } from '@nestjs/common';
import { IContentRepository } from './content-repository.interface';
import { UpdateContentDto } from '../dto/update-content.dto';

// Content validation service following SRP and OCP principles
// Focused on technical validation constraints rather than business rules
@Injectable()
export class ContentValidationService {
  private readonly logger = new Logger(ContentValidationService.name);

  constructor(@Inject('IContentRepository') private readonly contentRepository: IContentRepository) {}

  async validateUpdateConstraints(
    contentId: number, 
    updateDto: UpdateContentDto
  ): Promise<void> {
    this.logger.debug(`Validation called for content ${contentId}`);
    
    const errors: string[] = [];

    // Technical validation constraints
    
    // Length validations for database constraints
    if (updateDto.title && updateDto.title.length > 500) {
      errors.push('Episode title must be under 500 characters');
    }

    if (updateDto.youtubeId && updateDto.youtubeId.length > 100) {
      errors.push('YouTube ID must be under 100 characters');
    }

    if (updateDto.videoUrl && updateDto.videoUrl.length > 2000) {
      errors.push('Video URL must be under 2000 characters');
    }

    if (updateDto.thumbnailUrl && updateDto.thumbnailUrl.length > 2000) {
      errors.push('Thumbnail URL must be under 2000 characters');
    }

    // URL format validation
    if (updateDto.videoUrl && !this.isValidUrl(updateDto.videoUrl)) {
      errors.push('Video URL must be a valid URL');
    }

    if (updateDto.thumbnailUrl && !this.isValidUrl(updateDto.thumbnailUrl)) {
      errors.push('Thumbnail URL must be a valid URL');
    }

    if (errors.length > 0) {
      this.logger.warn(`Validation failed: ${errors.join(', ')}`);
      throw new BadRequestException({
        message: 'Content validation failed',
        errors,
        code: 'CONTENT_VALIDATION_ERROR'
      });
    }

    this.logger.debug(`Validation passed for content ${contentId}`);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
} 
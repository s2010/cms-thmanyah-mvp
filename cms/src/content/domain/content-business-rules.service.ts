import { Injectable, BadRequestException } from '@nestjs/common';
import { Content } from '../content.entity';
import { CreateContentDto } from '../dto/create-content.dto';

interface ValidationRule {
  validate(dto: CreateContentDto): void;
}

interface ContentPolicy {
  requiresReview(content: Content): boolean;
  canPublishImmediately(content: Content): boolean;
  determinePriority(content: Content): 'high' | 'normal' | 'low';
}

@Injectable()
export class ContentBusinessRulesService implements ValidationRule, ContentPolicy {
  private readonly REVIEW_THRESHOLD_WORDS = 1000;
  private readonly MAX_SCHEDULE_DAYS = 180;
  private readonly MINIMUM_WORDS = 10;

  validate(dto: CreateContentDto): void {
    this.validateScheduling(dto.publishedAt);
    this.validateContentQuality(dto);
    this.validateUrls(dto);
  }

  validateContentCreation = this.validate; // Maintain backward compatibility

  requiresReview(content: Content): boolean {
    const wordCount = this.getWordCount(content.body);
    return wordCount > this.REVIEW_THRESHOLD_WORDS || 
           this.containsSensitiveTopics(content.body);
  }

  requiresEditorialReview = this.requiresReview; // Maintain backward compatibility

  canPublishImmediately(content: Content): boolean {
    if (!content.publishedAt) return true;
    
    const publishDate = new Date(content.publishedAt);
    const now = new Date();
    
    return publishDate <= now;
  }

  determinePriority(content: Content): 'high' | 'normal' | 'low' {
    if (this.isOfficialPodcast(content)) {
      return 'high';
    }
    
    if (this.isUrgentContent(content.title)) {
      return 'high';
    }
    
    return 'normal';
  }

  determineContentPriority = this.determinePriority; // Maintain backward compatibility

  private validateScheduling(publishedAt?: string): void {
    if (!publishedAt) return;

    const publishDate = new Date(publishedAt);
    const now = new Date();
    const maxScheduleDate = new Date();
    maxScheduleDate.setDate(now.getDate() + this.MAX_SCHEDULE_DAYS);

    if (publishDate < now) {
      throw new BadRequestException('Cannot schedule content in the past');
    }

    if (publishDate > maxScheduleDate) {
      throw new BadRequestException(
        `Content cannot be scheduled more than ${this.MAX_SCHEDULE_DAYS} days in advance`
      );
    }
  }

  private validateContentQuality(dto: CreateContentDto): void {
    const wordCount = this.getWordCount(dto.body);
    
    if (wordCount < this.MINIMUM_WORDS) {
      throw new BadRequestException(`Content must contain at least ${this.MINIMUM_WORDS} words`);
    }

    if (this.containsProhibitedContent(dto.body)) {
      throw new BadRequestException('Content contains prohibited material');
    }
  }

  private validateUrls(dto: CreateContentDto): void {
    if (dto.videoUrl && !this.isValidVideoUrl(dto.videoUrl)) {
      throw new BadRequestException('Video URL must be from an approved platform');
    }
  }

  private getWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private containsProhibitedContent(text: string): boolean {
    const prohibitedPatterns = [
      /spam/gi,
      /\b(buy now|click here)\b/gi,
      /\b(get rich quick|make money fast)\b/gi,
    ];
    
    return prohibitedPatterns.some(pattern => pattern.test(text));
  }

  private containsSensitiveTopics(text: string): boolean {
    const sensitiveKeywords = [
      'medical advice', 
      'financial advice', 
      'legal advice',
      'investment recommendation',
      'health diagnosis'
    ];
    
    const lowerText = text.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerText.includes(keyword));
  }

  private isValidVideoUrl(url: string): boolean {
    const allowedDomains = [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'soundcloud.com'
    ];
    
    try {
      const urlObj = new URL(url);
      return allowedDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  private isOfficialPodcast(content: Content): boolean {
    return content.youtubeId && 
           content.youtubeChannel?.toLowerCase().includes('thmanyah');
  }

  private isUrgentContent(title: string): boolean {
    const urgentIndicators = ['breaking', 'urgent', 'emergency', 'alert'];
    const lowerTitle = title.toLowerCase();
    return urgentIndicators.some(indicator => lowerTitle.includes(indicator));
  }
} 
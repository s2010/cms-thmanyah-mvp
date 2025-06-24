import { Injectable, Logger } from '@nestjs/common';
import { VideoMetadata, IVideoSyncTarget } from './domain/video-sync.interface';
import { ContentService } from '../content/content.service';
import { CreateContentDto } from '../content/dto/create-content.dto';

@Injectable()
export class YouTubeContentSyncService implements IVideoSyncTarget {
  private readonly logger = new Logger(YouTubeContentSyncService.name);
  private readonly syncTimestamps = new Map<string, Date>();

  constructor(private contentService: ContentService) {}

  async upsertVideo(metadata: VideoMetadata): Promise<void> {
    const contentDto: CreateContentDto = {
      title: metadata.title,
      body: this.formatVideoDescription(metadata.description, metadata.id),
      thumbnailUrl: metadata.thumbnailUrl,
      videoUrl: `https://www.youtube.com/watch?v=${metadata.id}`,
      publishedAt: metadata.publishedAt.toISOString(),
      isPublished: true,
      youtubeId: metadata.id,
      youtubeChannel: metadata.channelTitle,
    };

    await this.contentService.upsertVideoContent(contentDto);
    this.logger.debug(`Video synced: ${metadata.title}`);
  }

  async checkVideoExists(videoId: string): Promise<boolean> {
    try {
      const content = await this.contentService.findContentById(parseInt(videoId));
      return !!content;
    } catch {
      return false;
    }
  }

  async getLastSyncTimestamp(channelId: string): Promise<Date | null> {
    return this.syncTimestamps.get(channelId) || null;
  }

  async updateSyncTimestamp(channelId: string, timestamp: Date): Promise<void> {
    this.syncTimestamps.set(channelId, timestamp);
    this.logger.debug(`Updated sync timestamp for channel ${channelId}: ${timestamp}`);
  }

  private formatVideoDescription(description: string, videoId: string): string {
    const maxLength = 5000;
    let formatted = description.length > maxLength 
      ? `${description.substring(0, maxLength)}...` 
      : description;

    formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();
    formatted += `\n\n---\n\nWatch on YouTube: https://www.youtube.com/watch?v=${videoId}`;

    return formatted;
  }
} 
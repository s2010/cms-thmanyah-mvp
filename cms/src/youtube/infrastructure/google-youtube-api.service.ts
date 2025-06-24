import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { youtube_v3 } from 'googleapis';
import { VideoMetadata, IVideoDataProvider } from '../domain/video-sync.interface';

@Injectable()
export class GoogleYouTubeApiService implements IVideoDataProvider {
  private readonly logger = new Logger(GoogleYouTubeApiService.name);
  private readonly youtube: youtube_v3.Youtube;
  private quotaUsed = 0;
  private readonly quotaLimit = 10000; // Daily quota limit

  constructor(private configService: ConfigService) {
    this.youtube = new youtube_v3.Youtube({
      auth: this.configService.get('YOUTUBE_API_KEY'),
    });
  }

  async getChannelId(handle: string): Promise<string | null> {
    try {
      this.incrementQuota(1);
      
      const cleanHandle = handle.replace('@', '');
      
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: cleanHandle,
        type: ['channel'],
        maxResults: 1,
      });

      const channel = response.data.items?.[0];
      if (channel?.snippet?.channelId) {
        this.logger.debug(`Found channel: ${channel.snippet.channelId} for ${handle}`);
        return channel.snippet.channelId;
      }

      // Fallback search
      const fallbackResponse = await this.youtube.channels.list({
        part: ['id'],
        forUsername: cleanHandle,
      });

      return fallbackResponse.data.items?.[0]?.id || null;
    } catch (error) {
      this.logger.error(`Channel lookup failed for ${handle}: ${error.message}`);
      return null;
    }
  }

  async getChannelVideos(channelId: string, maxResults: number, publishedAfter?: Date): Promise<VideoMetadata[]> {
    try {
      this.incrementQuota(2); // Search + Videos list

      // Get uploads playlist
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails'],
        id: [channelId],
      });

      const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        throw new Error('No uploads playlist found');
      }

      // Get recent videos
      const playlistItems = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults,
      });

      const videoIds = playlistItems.data?.items
        ?.map(item => item.snippet?.resourceId?.videoId)
        .filter(Boolean) || [];

      if (videoIds.length === 0) {
        return [];
      }

      // Get detailed video info
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds as string[],
      });

      return this.mapVideosToMetadata(videosResponse.data.items || []);
    } catch (error) {
      this.handleApiError(error);
      return [];
    }
  }

  async validateApiAccess(): Promise<boolean> {
    try {
      this.incrementQuota(1);
      
      await this.youtube.search.list({
        part: ['id'],
        q: 'test',
        maxResults: 1,
      });
      
      return true;
    } catch (error) {
      this.logger.error(`API validation failed: ${error.message}`);
      return false;
    }
  }

  async getQuotaUsage(): Promise<{ used: number; limit: number }> {
    return {
      used: this.quotaUsed,
      limit: this.quotaLimit,
    };
  }

  private mapVideosToMetadata(videos: youtube_v3.Schema$Video[]): VideoMetadata[] {
    return videos
      .filter(video => video.id && video.snippet)
      .map(video => ({
        id: video.id!,
        title: video.snippet!.title || 'Untitled',
        description: video.snippet!.description || '',
        thumbnailUrl: this.selectBestThumbnail(video.snippet!.thumbnails),
        publishedAt: new Date(video.snippet!.publishedAt || Date.now()),
        duration: video.contentDetails?.duration,
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        channelId: video.snippet!.channelId!,
        channelTitle: video.snippet!.channelTitle || '',
      }));
  }

  private selectBestThumbnail(thumbnails?: youtube_v3.Schema$ThumbnailDetails): string {
    if (!thumbnails) return '';
    
    return (
      thumbnails.maxres?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      ''
    );
  }

  private incrementQuota(cost: number): void {
    this.quotaUsed += cost;
    if (this.quotaUsed > this.quotaLimit * 0.9) {
      this.logger.warn(`YouTube API quota usage high: ${this.quotaUsed}/${this.quotaLimit}`);
    }
  }

  private handleApiError(error: any): void {
    if (error.code === 403 || error.code === 429) {
      this.logger.warn('YouTube API rate limit reached');
    } else {
      this.logger.error(`YouTube API error: ${error.message}`);
    }
    throw error;
  }
} 
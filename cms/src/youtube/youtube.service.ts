import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SyncResult, SyncConfiguration, IVideoSyncTarget, IVideoDataProvider } from './domain/video-sync.interface';
import { ContentService } from '../content/content.service';
import { GoogleYouTubeApiService } from './infrastructure/google-youtube-api.service';

// YouTube sync service - imports videos from @thmanyahPodcasts 
// WARNING: YouTube API quota is only 10k/day, so don't go crazy with requests
// FIXME: Need Slack alerts when quota runs out - happens way too often
// TODO: Support YouTube Shorts - marketing team keeps asking for this
@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly syncConfig: SyncConfiguration;
  private syncInProgress = false;
  private lastSyncResult: SyncResult | null = null;

  constructor(
    @Inject('IVideoSyncTarget') 
    private readonly syncTarget: IVideoSyncTarget,
    @Inject('IVideoDataProvider') 
    private readonly dataProvider: IVideoDataProvider,
    private readonly configService: ConfigService,
  ) {
    this.syncConfig = this.buildSyncConfiguration();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledSync(): Promise<void> {
    if (this.syncInProgress) {
      this.logger.warn('Sync already running, skipping scheduled execution');
      return;
    }

    this.logger.log('Starting scheduled YouTube sync');
    
    try {
      const result = await this.syncChannel();
      this.lastSyncResult = result;
      this.logSyncCompletion(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Scheduled sync failed: ${errorMessage}`, errorStack);
    }
  }

  async syncChannel(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new BadRequestException('Sync operation already in progress');
    }

    this.syncInProgress = true;
    const result = this.createEmptySyncResult();

    try {
      const channelId = await this.dataProvider.getChannelId(this.syncConfig.channelHandle);
      if (!channelId) {
        throw new Error(`Channel not found: ${this.syncConfig.channelHandle}`);
      }

      const lastSyncTime = await this.syncTarget.getLastSyncTimestamp(channelId);
      const videos = await this.dataProvider.getChannelVideos(
        channelId, 
        this.syncConfig.maxVideosPerSync, 
        lastSyncTime
      );
      
      this.logger.log(`Processing ${videos.length} videos from channel`);

      for (const video of videos) {
        result.processed++;
        
        try {
          const exists = await this.syncTarget.checkVideoExists(video.id);
          await this.syncTarget.upsertVideo(video);
          
          if (exists) {
            result.updated++;
            this.logger.debug(`Updated: "${video.title}"`);
          } else {
            result.created++;
            this.logger.debug(`Created: "${video.title}"`);
          }
          
        } catch (videoError) {
          result.failed++;
          const errorMessage = videoError instanceof Error ? videoError.message : String(videoError);
          result.errors.push(`${video.title}: ${errorMessage}`);
          this.logger.warn(`Failed to sync video ${video.id}: ${errorMessage}`);
        }
      }

      await this.syncTarget.updateSyncTimestamp(channelId, new Date());
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Channel sync failed: ${errorMessage}`, errorStack);
      throw new BadRequestException(`Sync operation failed: ${errorMessage}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  async getApiHealth(): Promise<{ healthy: boolean; quotaUsed?: number; error?: string }> {
    try {
      const isAccessible = await this.dataProvider.validateApiAccess();
      if (!isAccessible) {
        return { healthy: false, error: 'API validation failed - check credentials' };
      }

      const quotaInfo = await this.dataProvider.getQuotaUsage();
      
      if (quotaInfo.used > 8000) {
        this.logger.warn(`High API quota usage: ${quotaInfo.used}/10000 units`);
      }
      
      return {
        healthy: true,
        quotaUsed: quotaInfo.used,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`API health check failed: ${errorMessage}`, errorStack);
      return { healthy: false, error: errorMessage };
    }
  }

  async getSyncStats(): Promise<{
    lastSyncResult: SyncResult | null;
    syncCurrentlyRunning: boolean;
    syncEnabled: boolean;
    channelHandle: string;
    nextScheduledSync: Date;
  }> {
    const nextSync = new Date();
    nextSync.setHours(nextSync.getHours() + this.syncConfig.syncIntervalHours);

    return {
      lastSyncResult: this.lastSyncResult,
      syncCurrentlyRunning: this.syncInProgress,
      syncEnabled: !!this.configService.get('YOUTUBE_API_KEY'),
      channelHandle: this.syncConfig.channelHandle,
      nextScheduledSync: nextSync,
    };
  }

  async triggerManualSync(): Promise<SyncResult> {
    this.logger.log('Manual sync triggered by administrator');
    return this.syncChannel();
  }

  // Controller compatibility methods
  async syncChannelVideos(): Promise<SyncResult> {
    return this.syncChannel();
  }

  async getApiStatus(): Promise<{ healthy: boolean; quotaUsed?: number; error?: string }> {
    return this.getApiHealth();
  }

  getSyncConfiguration(): SyncConfiguration {
    return { ...this.syncConfig };
  }

  updateSyncConfiguration(updates: Partial<SyncConfiguration>): void {
    Object.assign(this.syncConfig, updates);
    this.logger.log('Sync configuration updated', updates);
  }

  private buildSyncConfiguration(): SyncConfiguration {
    return {
      channelHandle: this.configService.get('YOUTUBE_CHANNEL_HANDLE', '@thmanyahPodcasts'),
      maxVideosPerSync: parseInt(this.configService.get('YOUTUBE_MAX_VIDEOS_PER_SYNC', '20')),
      syncIntervalHours: parseInt(this.configService.get('YOUTUBE_SYNC_INTERVAL_HOURS', '1')),
      autoPublish: this.configService.get('YOUTUBE_AUTO_PUBLISH', 'true') === 'true',
    };
  }

  private createEmptySyncResult(): SyncResult {
    return {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }

  private logSyncCompletion(result: SyncResult): void {
    this.logger.log(
      `Sync completed: ${result.created} created, ${result.updated} updated, ${result.failed} failed`
    );
  }
} 
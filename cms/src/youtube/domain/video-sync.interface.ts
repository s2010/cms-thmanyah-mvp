export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  duration?: string;
  viewCount?: number;
  channelId: string;
  channelTitle: string;
}

export interface SyncResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface SyncConfiguration {
  channelHandle: string;
  maxVideosPerSync: number;
  syncIntervalHours: number;
  autoPublish: boolean;
  skipOlderThan?: Date;
}

export interface IVideoSyncTarget {
  upsertVideo(metadata: VideoMetadata): Promise<void>;
  checkVideoExists(videoId: string): Promise<boolean>;
  getLastSyncTimestamp(channelId: string): Promise<Date | null>;
  updateSyncTimestamp(channelId: string, timestamp: Date): Promise<void>;
}

export interface IVideoDataProvider {
  getChannelId(handle: string): Promise<string | null>;
  getChannelVideos(channelId: string, maxResults: number, publishedAfter?: Date): Promise<VideoMetadata[]>;
  validateApiAccess(): Promise<boolean>;
  getQuotaUsage(): Promise<{ used: number; limit: number }>;
} 
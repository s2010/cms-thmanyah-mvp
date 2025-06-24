import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { ContentModule } from '../content/content.module';
import { AuthModule } from '../auth/auth.module';
import { YouTubeContentSyncService } from './youtube-content-sync.service';
import { GoogleYouTubeApiService } from './infrastructure/google-youtube-api.service';

@Module({
  imports: [
    ConfigModule,
    ContentModule,
    AuthModule,
  ],
  controllers: [YoutubeController],
  providers: [
    YoutubeService,
    YouTubeContentSyncService,
    GoogleYouTubeApiService,
    {
      provide: 'IVideoSyncTarget',
      useClass: YouTubeContentSyncService,
    },
    {
      provide: 'IVideoDataProvider',
      useClass: GoogleYouTubeApiService,
    },
  ],
  exports: [YoutubeService, 'IVideoSyncTarget', 'IVideoDataProvider'],
})
export class YoutubeModule {} 
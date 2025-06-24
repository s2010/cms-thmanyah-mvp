import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { YoutubeService } from './youtube.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('sync')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  // Manual YouTube sync - admin only
  @Post('youtube')
  @UseGuards(AuthGuard)
  async manualSync() {
    const result = await this.youtubeService.syncChannelVideos();
    
    return {
      success: true,
      message: `YouTube sync completed: ${result.created} created, ${result.updated} updated`,
      data: result,
    };
  }

  // YouTube API health check - admin only
  @Get('youtube/health')
  @UseGuards(AuthGuard)
  async checkHealth() {
    const health = await this.youtubeService.getApiStatus();
    
    return {
      success: health.healthy,
      message: health.healthy ? 'YouTube API is accessible' : 'YouTube API error',
      data: health,
    };
  }

  // Get sync statistics - admin only
  @Get('youtube/stats')
  @UseGuards(AuthGuard)
  async getSyncStats() {
    const stats = await this.youtubeService.getSyncStats();
    
    return {
      success: true,
      message: 'Sync statistics retrieved',
      data: stats,
    };
  }

  // Public endpoint to check if YouTube sync is enabled
  @Get('youtube/status')
  async getSyncStatus() {
    const stats = await this.youtubeService.getSyncStats();
    
    return {
      success: true,
      message: 'Sync status retrieved',
      data: {
        enabled: stats.syncEnabled,
        lastSync: stats.lastSyncResult ? new Date() : null,
      },
    };
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content } from '../content/content.entity';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
  ) {}

  async getHealthStatus(): Promise<{ healthy: boolean; services: any }> {
    const services = {
      database: await this.checkDatabase(),
      cache: await this.checkCache(),
      youtube: await this.checkYouTubeAPI(),
    };

    const healthy = Object.values(services).every(service => service.status === 'healthy');

    return { healthy, services };
  }

  async isReady(): Promise<boolean> {
    try {
      // Check if database is responding
      const dbCheck = await this.checkDatabase();
      return dbCheck.status === 'healthy';
    } catch (error) {
      this.logger.error(`Readiness check failed: ${error.message}`);
      return false;
    }
  }

  private async checkDatabase(): Promise<{ status: string; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Simple query to test database connectivity
      await this.contentRepository.query('SELECT 1');
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkCache(): Promise<{ status: string; message: string }> {
    // Basic cache health check - in a real app, you'd test actual cache operations
    try {
      return {
        status: 'healthy',
        message: 'In-memory cache operational',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Cache error: ${error.message}`,
      };
    }
  }

  private async checkYouTubeAPI(): Promise<{ status: string; message: string }> {
    try {
      // Basic check - verify API key exists
      const hasApiKey = !!process.env.YOUTUBE_API_KEY;
      
      return {
        status: hasApiKey ? 'healthy' : 'degraded',
        message: hasApiKey ? 'YouTube API configured' : 'YouTube API key missing',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `YouTube API check failed: ${error.message}`,
      };
    }
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    database: { status: 'connected' | 'disconnected'; responseTime?: number };
    cache: { status: 'connected' | 'disconnected'; responseTime?: number };
    memory: { used: number; available: number; percentage: number };
    uptime: number;
    timestamp: string;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // Check database connection
      const databaseHealth = await this.checkDatabaseHealth();
      
      // For now, assume cache is healthy (in-memory cache)
      const cacheHealth = { status: 'connected' as const, responseTime: 1 };

      // Check memory usage
      const memoryHealth = this.checkMemoryHealth();
      
      const responseTime = Date.now() - startTime;
      const isHealthy = databaseHealth.status === 'connected' && cacheHealth.status === 'connected';
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        database: databaseHealth,
        cache: cacheHealth,
        memory: memoryHealth,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', (error as Error).message);
      return {
        status: 'unhealthy',
        database: { status: 'disconnected' },
        cache: { status: 'disconnected' },
        memory: { used: 0, available: 0, percentage: 0 },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      };
    }
  }

  async checkReadiness(): Promise<{ ready: boolean; timestamp: string; error?: string }> {
    try {
      // Check if database is ready
      await this.dataSource.query('SELECT 1');
      
      return {
        ready: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Readiness check failed:', (error as Error).message);
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      };
    }
  }

  async checkLiveness(): Promise<{ alive: boolean; timestamp: string }> {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      };
  }

  private async checkDatabaseHealth(): Promise<{ status: 'connected' | 'disconnected'; responseTime?: number }> {
    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      return { status: 'connected', responseTime };
    } catch (error) {
      this.logger.error('Database health check failed:', (error as Error).message);
      return { status: 'disconnected' };
    }
  }

  private checkMemoryHealth(): { used: number; available: number; percentage: number } {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const availableMemory = totalMemory - usedMemory;
    const percentage = (usedMemory / totalMemory) * 100;

    return {
      used: Math.round(usedMemory / 1024 / 1024), // Convert to MB
      available: Math.round(availableMemory / 1024 / 1024), // Convert to MB
      percentage: Math.round(percentage),
    };
  }
} 
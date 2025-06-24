import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async checkHealth() {
    const status = await this.healthService.getHealthStatus();
    
    return {
      status: status.healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: status.services,
    };
  }

  @Get('ready')
  async checkReadiness() {
    const isReady = await this.healthService.isReady();
    
    if (!isReady) {
      throw new Error('Service not ready');
    }
    
    return {
      status: 'ready',
      message: 'Service is ready to accept requests',
    };
  }

  @Get('live')
  checkLiveness() {
    // Simple liveness check - if this endpoint responds, the app is alive
    return {
      status: 'alive',
      message: 'Service is running',
      pid: process.pid,
    };
  }
} 
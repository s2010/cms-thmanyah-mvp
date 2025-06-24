import { Controller, Get, Logger } from '@nestjs/common';
import { HealthService } from './health.service';

// Health Check Controller
//   Provides health status endpoints for the discovery service.
//   Used by load balancers and monitoring systems.
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  // GET /health
  //   Basic health check endpoint
  @Get()
  async check() {
    try {
      const health = await this.healthService.checkHealth();
      
      return {
        ...health,
        service: 'thmanyah-discovery',
        version: '1.0.0',
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${(error as Error).message}`, (error as Error).stack);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'thmanyah-discovery',
        error: 'Health check failed',
      };
    }
  }

  // GET /health/ready
  //   Readiness probe for Kubernetes
  @Get('ready')
  async ready() {
    try {
      const result = await this.healthService.checkReadiness();
      return result;
    } catch (error) {
      this.logger.error(`Readiness check failed: ${(error as Error).message}`, (error as Error).stack);
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed',
      };
    }
  }

  // GET /health/live
  //   Liveness probe for Kubernetes
  @Get('live')
  async live() {
    try {
      const result = await this.healthService.checkLiveness();
      return result;
    } catch (error) {
      this.logger.error(`Liveness check failed: ${(error as Error).message}`, (error as Error).stack);
      return {
        alive: false,
        timestamp: new Date().toISOString(),
        error: 'Liveness check failed',
      };
    }
  }
} 
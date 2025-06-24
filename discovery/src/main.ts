import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

// Discovery Service Bootstrap
//   High-performance read-only API for content discovery.
//   Optimized for caching and horizontal scaling.
async function bootstrap() {
  const logger = new Logger('DiscoveryBootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  
  // API versioning and prefix configuration
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);
  
  // Request validation middleware
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    disableErrorMessages: false,
  }));

  // CORS configuration for public API
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3001;
  const serviceName = configService.get<string>('SERVICE_NAME', 'discovery');
  
  await app.listen(port, '0.0.0.0');
  
  logger.log(`${serviceName} service running on port ${port}`);
  logger.log(`API available at: http://localhost:${port}/${apiPrefix}`);
  logger.log(`Health check: http://localhost:${port}/${apiPrefix}/health`);
}

bootstrap().catch(err => {
  console.error('Failed to start discovery service:', err);
  process.exit(1);
}); 
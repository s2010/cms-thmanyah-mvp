import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { Content } from '../content/content.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content]), // Import content entity for database health checks
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService], // Export for use in other modules if needed
})
export class HealthModule {} 
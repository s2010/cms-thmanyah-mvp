import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { Content } from './content.entity';
import { AuthModule } from '../auth/auth.module';
import { ContentBusinessRulesService } from './business/content-business-rules.service';
import { CacheInvalidationModule } from '../cache/cache-invalidation.module';
import { TypeOrmContentRepository } from './infrastructure/typeorm-content.repository';
import { ContentValidationService } from './domain/content-validation.service';
import { IContentRepository } from './domain/content-repository.interface';


@Module({
  imports: [
    TypeOrmModule.forFeature([Content]),
    AuthModule,
    CacheInvalidationModule,
  ],
  controllers: [ContentController],
  providers: [
    ContentService,
    ContentBusinessRulesService,
    ContentValidationService,
    TypeOrmContentRepository,
    {
      provide: 'IContentRepository',
      useClass: TypeOrmContentRepository,
    },
  ],
  exports: [ContentService],
})
export class ContentModule {} 
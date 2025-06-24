import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { YoutubeModule } from './youtube/youtube.module';
import { HealthModule } from './health/health.module';
import { CacheInvalidationModule } from './cache/cache-invalidation.module';
import { Content } from './content/content.entity';

 
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env' : '.env.local',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'password'),
        database: configService.get('DB_DATABASE', 'thmanyah_cms'),
        entities: [Content],
        synchronize: process.env.NODE_ENV !== 'production',
        retryAttempts: 3,
        retryDelay: 1000,
        autoLoadEntities: true,
        logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
      }),
    }),
    
    CacheModule.register({
      isGlobal: true,
      ttl: parseInt(process.env.CACHE_TTL) || 60000,
      max: parseInt(process.env.CACHE_MAX) || 100,
    }),

    // Redis pub/sub for cache invalidation events
    ClientsModule.registerAsync([
      {
        name: 'CACHE_INVALIDATION_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB', 0),
            retryAttempts: 5,
            retryDelay: 3000,
          },
        }),
        inject: [ConfigService],
      },
    ]),
    
    ScheduleModule.forRoot(),
    AuthModule,
    ContentModule,
    YoutubeModule,
    HealthModule,
    CacheInvalidationModule,
  ],
})
export class AppModule {} 
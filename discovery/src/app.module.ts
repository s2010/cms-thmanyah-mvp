import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';

import { HealthModule } from './health/health.module';
import { ContentModule } from './content/content.module';


@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Read-only database connection (PostgreSQL replica)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DISCOVERY_DB_HOST', 'postgres'),
        port: configService.get<number>('DISCOVERY_DB_PORT', 5432),
        username: configService.get<string>('DISCOVERY_DB_USERNAME', 'postgres'),
        password: configService.get<string>('DISCOVERY_DB_PASSWORD', 'password'),
        database: configService.get<string>('DISCOVERY_DB_NAME', 'thmanyah_cms'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Read-only service - no schema changes
        logging: configService.get<string>('NODE_ENV') === 'development',
        ssl: configService.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        // Connection pooling for read replicas
        extra: {
          max: 20,
          min: 5,
          idle_timeout: 30000,
          connectionTimeoutMillis: 10000,
          statement_timeout: 30000,
        },
      }),
      inject: [ConfigService],
    }),

    // Caching with 60s TTL (Redis will be used in production via external configuration)
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get<number>('CACHE_TTL_SECONDS', 60) * 1000, // 60s as per design
        max: 1000, // Maximum items in cache
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    HealthModule,
    ContentModule,
  ],
})
export class AppModule {} 
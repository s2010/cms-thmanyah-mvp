import { DataSource } from 'typeorm';
import { Content } from './src/content/content.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'thmanyah_cms',
  entities: [Content],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'schema_migrations',
  logging: process.env.NODE_ENV === 'development',
  synchronize: false, // Never use synchronize in any environment
}); 
const { DataSource } = require('typeorm');
const { Content } = require('./dist/content/content.entity');

module.exports = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'thmanyah_cms',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'schema_migrations',
  logging: process.env.NODE_ENV === 'development',
  synchronize: false,
}); 
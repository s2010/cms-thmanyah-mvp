import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitialSchema1719241200000 implements MigrationInterface {
  name = 'InitialSchema1719241200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.hasTable('content');
    if (tableExists) {
      console.log('Content table exists, skipping migration');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'content',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'body',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'thumbnailUrl',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'videoUrl',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'publishedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isPublished',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'youtubeId',
            type: 'varchar',
            length: '50',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'youtubeChannel',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Performance indexes
    await queryRunner.createIndex(
      'content',
      new TableIndex({
        name: 'idx_content_published_at',
        columnNames: ['isPublished', 'publishedAt'],
      }),
    );

    await queryRunner.createIndex(
      'content',
      new TableIndex({
        name: 'idx_content_youtube_id',
        columnNames: ['youtubeId'],
      }),
    );

    await queryRunner.createIndex(
      'content',
      new TableIndex({
        name: 'idx_content_created_at',
        columnNames: ['createdAt'],
      }),
    );

    // Full-text search support for Arabic content
    await queryRunner.query(`
      CREATE INDEX idx_content_title_search ON content 
      USING gin(to_tsvector('arabic', title));
    `);

    await queryRunner.query(`
      CREATE INDEX idx_content_body_search ON content 
      USING gin(to_tsvector('arabic', body));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('content', 'idx_content_body_search');
    await queryRunner.dropIndex('content', 'idx_content_title_search');
    await queryRunner.dropIndex('content', 'idx_content_created_at');
    await queryRunner.dropIndex('content', 'idx_content_youtube_id');
    await queryRunner.dropIndex('content', 'idx_content_published_at');
    await queryRunner.dropTable('content');
  }
} 
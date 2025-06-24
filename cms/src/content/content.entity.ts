import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('content')
@Index(['isPublished', 'publishedAt']) // Query optimization for public content
@Index(['publishedAt']) // Sorting optimization
export class Content {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  @Index() // Enable text search on titles
  title: string;

  @Column('text')
  body: string;

  @Column({ length: 2000, nullable: true })
  thumbnailUrl: string;

  @Column({ length: 2000, nullable: true })
  videoUrl: string;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @Column({ default: true })
  @Index() // Filter published content efficiently
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // YouTube-specific metadata - removed unique constraint to allow flexibility
  // This enables content variations, re-uploads, and different versions
  @Column({ length: 100, nullable: true })
  youtubeId: string;

  @Column({ length: 500, nullable: true })
  youtubeChannel: string;

  // Simple computed property for search indexing
  get searchableText(): string {
    return `${this.title} ${this.body}`.toLowerCase();
  }
} 
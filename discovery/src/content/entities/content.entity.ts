import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Content Entity - Read-only representation for discovery service
 * 
 * Optimized for read operations with proper indexing for performance.
 * Mirrors the CMS content structure but focused on published content only.
 */
@Entity('content')
@Index(['isPublished', 'publishedAt']) // Performance index for published content queries
@Index(['publishedAt']) // Performance index for chronological ordering
export class Content {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500 })
  @Index() // Search optimization
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  videoUrl?: string;

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Computed properties for API responses
  get isAvailableForDiscovery(): boolean {
    return this.isPublished && this.publishedAt != null;
  }

  get excerpt(): string {
    if (!this.body) return '';
    // Extract first 200 characters for preview
    const plainText = this.body.replace(/<[^>]*>/g, '').trim();
    return plainText.length > 200 ? plainText.substring(0, 197) + '...' : plainText;
  }
} 
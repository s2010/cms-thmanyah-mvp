import { Content } from '../content.entity';
import { CreateContentDto } from '../dto/create-content.dto';
import { UpdateContentDto } from '../dto/update-content.dto';

export interface ContentFilter {
  isPublished?: boolean;
  youtubeChannel?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  titleContains?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
}

export interface IContentRepository {
  // Core CRUD operations
  create(dto: CreateContentDto): Promise<Content>;
  findById(id: number): Promise<Content | null>;
  findByYoutubeId(youtubeId: string): Promise<Content | null>;
  update(id: number, dto: UpdateContentDto): Promise<Content>;
  remove(id: number): Promise<void>;
  
  // Query operations
  findMany(filter: ContentFilter, page: number, limit: number): Promise<PaginatedResult<Content>>;
  findAll(page: number, limit: number): Promise<{ data: Content[]; total: number }>;
  exists(id: number): Promise<boolean>;
  
  // Validation helpers
  youtubeIdExists(youtubeId: string, excludeId?: number): Promise<boolean>;
  findDuplicateTitle(title: string, excludeId?: number): Promise<Content | null>;
  
  // Bulk operations
  bulkUpsertByYoutubeId(contents: CreateContentDto[]): Promise<Content[]>;
  
  // Statistics
  countByStatus(isPublished: boolean): Promise<number>;
}

export interface ContentUpdateValidation {
  isValid: boolean;
  errors: string[];
  conflictingField?: string;
} 
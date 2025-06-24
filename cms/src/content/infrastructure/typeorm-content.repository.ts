import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { Content } from '../content.entity';
import { CreateContentDto } from '../dto/create-content.dto';
import { UpdateContentDto } from '../dto/update-content.dto';
import { IContentRepository, ContentFilter, PaginatedResult } from '../domain/content-repository.interface';

@Injectable()
export class TypeOrmContentRepository implements IContentRepository {
  private readonly logger = new Logger(TypeOrmContentRepository.name);

  constructor(
    @InjectRepository(Content)
    private repository: Repository<Content>,
  ) {}

  async create(dto: CreateContentDto): Promise<Content> {
    try {
      const content = this.repository.create(dto);
      const saved = await this.repository.save(content);
      this.logger.log(`Content created: ${saved.title} (${saved.id})`);
      return saved;
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        this.logger.warn(`Duplicate content creation attempted: ${dto.title}`);
        throw new Error('Content with this YouTube ID already exists');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateContentDto): Promise<Content> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Content ${id} not found`);
    }

    await this.repository.update(id, dto);
    const updated = await this.findById(id);
    this.logger.log(`Content updated: ${updated.title} (${id})`);
    return updated;
  }

  async findById(id: number): Promise<Content | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByYoutubeId(youtubeId: string): Promise<Content | null> {
    return this.repository.findOne({ where: { youtubeId } });
  }

  async findMany(filter: ContentFilter, page: number, limit: number): Promise<PaginatedResult<Content>> {
    const queryBuilder = this.repository.createQueryBuilder('content');

    if (filter.isPublished !== undefined) {
      queryBuilder.andWhere('content.isPublished = :isPublished', { isPublished: filter.isPublished });
    }

    if (filter.youtubeChannel) {
      queryBuilder.andWhere('content.youtubeChannel = :channel', { channel: filter.youtubeChannel });
    }

    if (filter.publishedAfter) {
      queryBuilder.andWhere('content.publishedAt >= :after', { after: filter.publishedAfter });
    }

    if (filter.publishedBefore) {
      queryBuilder.andWhere('content.publishedAt <= :before', { before: filter.publishedBefore });
    }

    if (filter.titleContains) {
      queryBuilder.andWhere('LOWER(content.title) LIKE LOWER(:title)', { 
        title: `%${filter.titleContains}%` 
      });
    }

    const [data, total] = await queryBuilder
      .orderBy('content.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async findDuplicateTitle(title: string, excludeId?: number): Promise<Content | null> {
    const queryBuilder = this.repository.createQueryBuilder('content')
      .where('LOWER(content.title) = LOWER(:title)', { title });

    if (excludeId) {
      queryBuilder.andWhere('content.id != :excludeId', { excludeId });
    }

    return queryBuilder.getOne();
  }

  async countByStatus(isPublished: boolean): Promise<number> {
    return this.repository.count({ where: { isPublished } });
  }

  async remove(id: number): Promise<void> {
    const content = await this.findById(id);
    if (!content) {
      throw new NotFoundException(`Content ${id} not found`);
    }

    await this.repository.remove(content);
    this.logger.log(`Content deleted: ${content.title} (${id})`);
  }

  async bulkUpsertByYoutubeId(contents: CreateContentDto[]): Promise<Content[]> {
    const results: Content[] = [];
    
    for (const contentDto of contents) {
      try {
        const existing = contentDto.youtubeId 
          ? await this.findByYoutubeId(contentDto.youtubeId)
          : null;

        if (existing) {
          const updated = await this.update(existing.id, contentDto);
          results.push(updated);
        } else {
          const created = await this.create(contentDto);
          results.push(created);
        }
      } catch (error: any) {
        this.logger.error(`Bulk upsert failed for: ${contentDto.title}`, error.message);
      }
    }

    return results;
  }

  async findAll(page: number, limit: number): Promise<{ data: Content[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const [data, total] = await this.repository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.repository.count({ where: { id } });
    return count > 0;
  }

  async youtubeIdExists(youtubeId: string, excludeId?: number): Promise<boolean> {
    const query = this.repository.createQueryBuilder('content')
      .where('content.youtubeId = :youtubeId', { youtubeId });
    
    if (excludeId) {
      query.andWhere('content.id != :excludeId', { excludeId });
    }
    
    const count = await query.getCount();
    return count > 0;
  }
} 
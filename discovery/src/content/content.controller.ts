import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ContentDiscoveryBusinessService } from './domain/content-discovery-business.service';

// Public discovery API - all the endpoints mobile apps use
// IMPORTANT: Everything is cached with Redis for <100ms response times
// FIXME: Arabic search relevance is pretty bad - needs Elasticsearch
// TODO: Episode transcripts for accessibility - legal requirement soon
@Controller('content')
export class ContentController {
  private readonly logger = new Logger('ThmanyahPublicAPI');

  constructor(
    private readonly thmanyahDiscoveryService: ContentDiscoveryBusinessService,
  ) {}

  // GET /content - Browse all published podcast episodes
  //   page: pagination (1-based, default: 1)
  //  limit: episodes per page (max: 50, default: 20)
  @Get()
  async getAllEpisodes(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) episodePage: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) episodesPerPage: number,
  ) {
    try {
      const episodeResults = await this.thmanyahDiscoveryService.findPublishedContent(episodePage, episodesPerPage);
      
      return {
        success: true,
        message: this.buildEpisodeListMessage(episodeResults.total, episodePage),
        ...episodeResults,
        meta: {
          requestedPage: episodePage,
          requestedLimit: episodesPerPage,
          apiVersion: '2.1',
          timestamp: new Date().toISOString(),
          // Help mobile apps with Arabic text rendering
          rtlSupport: true,
        },
      };
    } catch (error: any) {
      this.logger.error(`Episode list API failed: ${error?.message || 'Unknown error'}`, error?.stack);
      throw new HttpException(
        'خطأ في تحميل الحلقات. الرجاء المحاولة مرة أخرى.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  // GET /content/search - Search podcast episodes
  //  Arabic fuzzzy matching not perfect (needs Elasticsearch)
  //  Mixed Arabic/English queries sometimes return unexpected results
  @Get('search')
  async searchEpisodes(
    @Query('q') searchQuery: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) resultsPage: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) resultsPerPage: number,
  ) {
    try {
      // 2 char minimum because Arabic diacritics mess up single char search
      if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length < 2) {
        throw new HttpException(
          'يجب أن يحتوي البحث على حرفين على الأقل',
          HttpStatus.BAD_REQUEST,
        );
      }

      const searchResults = await this.thmanyahDiscoveryService.searchPublishedContent(
        searchQuery,
        resultsPage,
        resultsPerPage
      );
      
      return {
        success: true,
        message: this.buildPodcastSearchMessage(searchResults.total, searchResults.query),
        ...searchResults,
        meta: {
          requestedPage: resultsPage,
          requestedLimit: resultsPerPage,
          searchExecutionTime: `${searchResults.searchTime}ms`,
          searchLanguage: this.detectSearchLanguage(searchQuery),
          timestamp: new Date().toISOString(),
          // Track performance for search optimization
          searchPerformance: searchResults.searchTime < 100 ? 'fast' : 'slow',
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Search API failed for query "${searchQuery}": ${error?.message || 'Unknown error'}`, error?.stack);
      throw new HttpException(
        'البحث غير متاح حالياً. الرجاء المحاولة لاحقاً.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /content/latest - Latest podcast episodes
  //   Returns newest episodes regardless of series/category
  //   Mobile app note: This is cached aggressively (30s TTL) to handle traffic spikes
  @Get('latest')
  async getLatestEpisodes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) episodeCount: number,
  ) {
    try {
      const latestEpisodes = await this.thmanyahDiscoveryService.getLatestPublished(episodeCount);
      
      return {
        success: true,
        message: `تم العثور على ${latestEpisodes.length} حلقة جديدة`,
        data: latestEpisodes,
        count: latestEpisodes.length,
        meta: {
          requestedLimit: episodeCount,
          timestamp: new Date().toISOString(),
          mobileOptimized: true,
          // Only preload thumbnails for small lists to save bandwidth
          preloadImages: latestEpisodes.length <= 5,
        },
      };
    } catch (error: any) {
      this.logger.error(`Latest episodes API failed: ${error?.message || 'Unknown error'}`, error?.stack);
      throw new HttpException(
        'لا يمكن تحميل الحلقات الجديدة الآن',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // GET /content/:id - Get single episode details
  //   Primary endpoint for episode detail pages and podcast players.
  //   Returns full episode metadata including transcripts (when available).
  //   Performance: Cached per episode for 60s, critical for player functionality
  @Get(':id')
  async getEpisodeById(@Param('id', ParseIntPipe) episodeId: number) {
    try {
      const podcastEpisode = await this.thmanyahDiscoveryService.findPublishedById(episodeId);
      
      return {
        success: true,
        message: 'تم تحميل الحلقة بنجاح',
        data: podcastEpisode,
        meta: {
          episodeId: episodeId,
          timestamp: new Date().toISOString(),
          audioReady: !!podcastEpisode.videoUrl,
          hasTranscript: false,
          estimatedDuration: this.estimateEpisodeDuration(podcastEpisode),
        },
      };
    } catch (error: any) {
      if (error?.message?.includes('not found') || error?.message?.includes('Invalid')) {
        throw new HttpException(
          `الحلقة رقم ${episodeId} غير موجودة أو غير منشورة`,
          HttpStatus.NOT_FOUND,
        );
      }
      
      this.logger.error(`Episode ${episodeId} retrieval failed: ${error?.message || 'Unknown error'}`, error?.stack);
      throw new HttpException(
        'خطأ في تحميل الحلقة. الرجاء المحاولة مرة أخرى',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Private helpers - evolved over months of Arabic podcast platform development

  private buildEpisodeListMessage(totalEpisodes: number, currentPage: number): string {
    if (totalEpisodes === 0) {
      return 'لا توجد حلقات منشورة حالياً';
    }
    
    if (currentPage === 1) {
      return `تم العثور على ${totalEpisodes} حلقة منشورة`;
    }
    
    return `الصفحة ${currentPage} من الحلقات (${totalEpisodes} حلقة إجمالاً)`;
  }

  private buildPodcastSearchMessage(totalResults: number, searchTerm: string): string {
    if (totalResults === 0) {
      return `لم يتم العثور على حلقات تحتوي على "${searchTerm}". جرب كلمات أخرى`;
    }
    
    if (totalResults === 1) {
      return `تم العثور على حلقة واحدة تحتوي على "${searchTerm}"`;
    }
    
    return `تم العثور على ${totalResults} حلقة تحتوي على "${searchTerm}"`;
  }

  // Detect if search query is primarily Arabic or English
  // Used for search analytics and result optimization
  private detectSearchLanguage(query: string): 'arabic' | 'english' | 'mixed' {
    const arabicCharPattern = /[\u0600-\u06FF]/;
    const englishCharPattern = /[a-zA-Z]/;
    
    const hasArabic = arabicCharPattern.test(query);
    const hasEnglish = englishCharPattern.test(query);
    
    if (hasArabic && hasEnglish) return 'mixed';
    if (hasArabic) return 'arabic';
    if (hasEnglish) return 'english';
    
    return 'mixed'; // Default for ambiguous cases
  }

  // Rough episode duration estimation based on content length
  // TODO: Replace with actual audio duration from metadata
  private estimateEpisodeDuration(episode: any): string {
    if (!episode.body) return 'غير محدد';
    
    const wordCount = episode.body.split(' ').length;
    // Arabic speaking pace ~150 words/minute
    const estimatedMinutes = Math.round(wordCount / 150);
    
    if (estimatedMinutes < 60) {
      return `${estimatedMinutes} دقيقة تقريباً`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      return `${hours} ساعة و ${minutes} دقيقة تقريباً`;
    }
  }
} 
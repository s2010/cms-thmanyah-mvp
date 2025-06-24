import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  IContentDiscoveryRepository, 
  IContentCacheManager, 
  ContentListResult, 
  ContentSearchResult 
} from './content-discovery.repository.interface';
import { Content } from '../entities/content.entity';


@Injectable()
export class ContentDiscoveryBusinessService {
  private readonly logger = new Logger('ThmanyahDiscoveryEngine');
  
  private readonly maxEpisodesPerPage: number;
  private readonly defaultEpisodePageSize: number;
  private readonly maxSearchResultsPerPage: number;
  private readonly podcastCacheDuration: number;
  private readonly searchResultsCacheDuration: number;

  constructor(
    @Inject('IContentDiscoveryRepository')
    private readonly thmanyahContentRepo: IContentDiscoveryRepository,
    @Inject('IContentCacheManager') 
    private readonly podcastCacheManager: IContentCacheManager,
    private readonly configService: ConfigService,
  ) {
    this.maxEpisodesPerPage = this.configService.get<number>('MAX_PAGE_SIZE', 50);
    this.defaultEpisodePageSize = this.configService.get<number>('DEFAULT_PAGE_SIZE', 20);
    this.maxSearchResultsPerPage = this.configService.get<number>('MAX_SEARCH_PAGE_SIZE', 30);
    this.podcastCacheDuration = this.configService.get<number>('CACHE_TTL_SECONDS', 60);
    this.searchResultsCacheDuration = this.configService.get<number>('SEARCH_CACHE_TTL_SECONDS', 30);
  }

  async findPublishedContent(episodePage: number = 1, episodeLimit: number = this.defaultEpisodePageSize): Promise<ContentListResult> {
         const sanitizedLimit = this.sanitizeEpisodeLimit(episodeLimit, this.maxEpisodesPerPage);
    const sanitizedPage = Math.max(episodePage, 1);

    const podcastCacheKey = this.podcastCacheManager.generateKey('thmanyah_episodes', sanitizedPage, sanitizedLimit);
    
    const cachedEpisodes = await this.podcastCacheManager.get<ContentListResult>(podcastCacheKey);
    if (cachedEpisodes) {
      this.logger.debug(`Cache hit for episode list: page ${sanitizedPage}`);
      return cachedEpisodes;
    }

    const episodeResults = await this.thmanyahContentRepo.findPublishedContent(sanitizedPage, sanitizedLimit);
    
    this.enhancePodcastListResult(episodeResults);
    
    await this.podcastCacheManager.set(podcastCacheKey, episodeResults, this.podcastCacheDuration);
    this.logger.debug(`Cached episode list: page ${sanitizedPage}, episodes: ${episodeResults.total}`);

    return episodeResults;
  }

  async findPublishedById(episodeId: number): Promise<Content> {
    if (!this.isValidEpisodeId(episodeId)) {
      throw new NotFoundException(`Invalid episode ID: ${episodeId}`);
    }

    const episodeCacheKey = this.podcastCacheManager.generateKey('thmanyah_episode', episodeId);
    
    const cachedEpisode = await this.podcastCacheManager.get<Content>(episodeCacheKey);
    if (cachedEpisode) {
      this.logger.debug(`Cache hit for episode: ${episodeId}`);
      return cachedEpisode;
    }

    const podcastEpisode = await this.thmanyahContentRepo.findPublishedById(episodeId);
    if (!podcastEpisode) {
      throw new NotFoundException(`Episode ${episodeId} not found or not published yet`);
    }

    await this.podcastCacheManager.set(episodeCacheKey, podcastEpisode, this.podcastCacheDuration);
    this.logger.debug(`Cached episode: ${episodeId} - "${podcastEpisode.title}"`);

    return podcastEpisode;
  }

  async searchPublishedContent(
    searchQuery: string, 
    resultsPage: number = 1, 
    resultsLimit: number = this.defaultEpisodePageSize
  ): Promise<ContentSearchResult> {
    const cleanSearchQuery = this.sanitizePodcastSearchQuery(searchQuery);
    if (!cleanSearchQuery) {
      return this.createEmptyPodcastSearchResult(searchQuery, resultsPage);
    }

    const sanitizedLimit = this.sanitizeEpisodeLimit(resultsLimit, this.maxSearchResultsPerPage);
    const sanitizedPage = Math.max(resultsPage, 1);

    const searchCacheKey = this.podcastCacheManager.generateKey('thmanyah_search', cleanSearchQuery, sanitizedPage, sanitizedLimit);
    
    const cachedSearchResults = await this.podcastCacheManager.get<ContentSearchResult>(searchCacheKey);
    if (cachedSearchResults) {
      this.logger.debug(`Search cache hit: "${cleanSearchQuery}" (${cachedSearchResults.total} episodes)`);
      return cachedSearchResults;
    }

    const searchStartTime = Date.now();
    const searchResults = await this.thmanyahContentRepo.searchPublishedContent(cleanSearchQuery, sanitizedPage, sanitizedLimit);
    const searchExecutionTime = Date.now() - searchStartTime;

    searchResults.searchTime = searchExecutionTime;
    this.enhancePodcastListResult(searchResults);

    await this.podcastCacheManager.set(searchCacheKey, searchResults, this.searchResultsCacheDuration);
    this.logger.debug(`Cached search: "${cleanSearchQuery}", found: ${searchResults.total}, time: ${searchExecutionTime}ms`);

    return searchResults;
  }

  async getLatestPublished(episodeCount: number = 10): Promise<Content[]> {
    const sanitizedEpisodeCount = Math.min(Math.max(episodeCount, 1), 50);
    
    const latestCacheKey = this.podcastCacheManager.generateKey('thmanyah_latest', sanitizedEpisodeCount);
    
    const cachedLatestEpisodes = await this.podcastCacheManager.get<Content[]>(latestCacheKey);
    if (cachedLatestEpisodes) {
      this.logger.debug(`Latest episodes cache hit: ${sanitizedEpisodeCount} items`);
      return cachedLatestEpisodes;
    }

    const latestEpisodes = await this.thmanyahContentRepo.getLatestPublished(sanitizedEpisodeCount);
    
    await this.podcastCacheManager.set(latestCacheKey, latestEpisodes, Math.min(this.podcastCacheDuration, 30));
    this.logger.debug(`Cached latest episodes: ${latestEpisodes.length} items`);

    return latestEpisodes;
  }

  async invalidateContentCache(episodeId?: number): Promise<void> {
    if (episodeId) {
      const episodeKey = this.podcastCacheManager.generateKey('thmanyah_episode', episodeId);
      await this.podcastCacheManager.delete(episodeKey);
      this.logger.debug(`Invalidated cache for episode: ${episodeId}`);
    }
    
    await this.podcastCacheManager.deleteByPattern('thmanyah_episodes*');
    await this.podcastCacheManager.deleteByPattern('thmanyah_search*');
    await this.podcastCacheManager.deleteByPattern('thmanyah_latest*');
    
    this.logger.debug('Invalidated all episode list and search caches');
  }

  private sanitizeEpisodeLimit(requestedLimit: number, platformMaxLimit: number): number {
    return Math.min(Math.max(requestedLimit, 1), platformMaxLimit);
  }

  private sanitizePodcastSearchQuery(userQuery: string): string {
    if (!userQuery || typeof userQuery !== 'string') return '';
    
    const cleanQuery = userQuery.trim();
    
    if (cleanQuery.length < 2) return '';
    
    // Prevent SQL injection and excessive query length
    if (cleanQuery.length > 100) return cleanQuery.substring(0, 100);
    
    return cleanQuery;
  }

  private isValidEpisodeId(episodeId: number): boolean {
    // Thmanyah episode IDs start from 1 and are always positive integers
    return Number.isInteger(episodeId) && episodeId > 0;
  }

  private enhancePodcastListResult(episodeResults: ContentListResult): void {
    // Add pagination metadata for mobile app navigation
    episodeResults.hasNext = episodeResults.page < episodeResults.lastPage;
    episodeResults.hasPrevious = episodeResults.page > 1;
  }

  private createEmptyPodcastSearchResult(originalQuery: string, requestedPage: number): ContentSearchResult {
    return {
      data: [],
      total: 0,
      page: Math.max(requestedPage, 1),
      lastPage: 0,
      hasNext: false,
      hasPrevious: false,
      query: originalQuery?.trim() || '',
      searchTime: 0,
    };
  }
} 
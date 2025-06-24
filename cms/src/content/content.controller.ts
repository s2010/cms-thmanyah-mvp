import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  ValidationPipe,
  Logger,
  BadRequestException,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { AuthGuard } from '../auth/auth.guard';

// Admin content management for Thmanyah podcast episodes
// Handles CRUD operations for Arabic podcast content from YouTube channel
@Controller('cms/content')
@UseGuards(AuthGuard)
export class ContentController {
  private readonly logger = new Logger('AdminContentAPI');

  constructor(private readonly contentService: ContentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(ValidationPipe) createContentDto: CreateContentDto) {
    try {
      this.logger.log(`Creating episode: "${createContentDto.title}"`);
    const content = await this.contentService.createContent(createContentDto);
    
    return {
      success: true,
        message: 'Episode created',
      data: content,
    };
    } catch (error) {
      return this.handleError(error, 'Episode creation failed');
    }
  }

  @Get()
  async findAll(
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    // Handle pagination params - they come as strings from query
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    
    if (isNaN(page) || page < 1) {
      throw new BadRequestException('Page must be a positive number');
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    this.logger.debug(`Fetching episodes: page=${page}, limit=${limit}`);
    const result = await this.contentService.findAll(page, limit);
    
    return {
      success: true,
      message: `Found ${result.total} episodes`,
      ...result,
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const content = await this.contentService.findContentById(id);
    
    return {
      success: true,
      message: 'Content found',
      data: content,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateContentDto: UpdateContentDto,
  ) {
    try {
      const content = await this.contentService.updateContent(id, updateContentDto);
      
      return {
        success: true,
        message: 'Content updated successfully',
        data: content,
      };
    } catch (error) {
      return this.handleError(error, 'Episode update failed');
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.contentService.removeContent(id);
    
    return {
      success: true,
      message: 'Content deleted successfully',
    };
  }

  // Bulk operations for better admin UX
  @Post('bulk-update-status')
  async bulkUpdateStatus(
    @Body() bulkUpdateDto: { ids: number[]; isPublished: boolean },
  ) {
    const results = [];
    
    for (const id of bulkUpdateDto.ids) {
      try {
        const content = await this.contentService.updateContent(id, {
          isPublished: bulkUpdateDto.isPublished,
        });
        results.push({ id, success: true, content });
      } catch (error: any) {
        results.push({ id, success: false, error: error.message });
      }
    }
    
    return {
      success: true,
      message: 'Bulk update completed',
      results,
    };
  }

  private handleError(error: any, context: string) {
    this.logger.error(`${context}: ${error.message}`);
    
    if (error instanceof BadRequestException && error.getResponse()) {
      const response = error.getResponse() as any;
      if (response.code === 'CONTENT_VALIDATION_ERROR') {
        throw new HttpException({
          success: false,
          message: response.message,
          errors: response.errors,
          timestamp: new Date().toISOString()
        }, HttpStatus.BAD_REQUEST);
      }
    }
    
    if (error instanceof HttpException) {
      throw error;
    }
    
    throw new HttpException({
      success: false,
      message: context,
      error: error.message,
      timestamp: new Date().toISOString()
    }, HttpStatus.INTERNAL_SERVER_ERROR);
  }
} 
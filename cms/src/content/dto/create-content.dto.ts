import { IsString, IsUrl, IsOptional, IsBoolean, IsDateString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContentDto {
  @IsString()
  @MaxLength(500, { message: 'Title cannot exceed 500 characters' })
  title: string;

  @IsString()
  @MaxLength(50000, { message: 'Content body too large' })
  body: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid thumbnail URL format' })
  thumbnailUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid video URL format' })
  videoUrl?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format' })
  @Transform(({ value }) => {
    // Prevent scheduling content too far in the future
    const date = new Date(value);
    const maxFutureDate = new Date();
    maxFutureDate.setMonth(maxFutureDate.getMonth() + 6);
    
    if (date > maxFutureDate) {
      throw new Error('Cannot schedule content more than 6 months in advance');
    }
    return value;
  })
  publishedAt?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean = true;

  // YouTube-specific fields for sync operations
  @IsOptional()
  @IsString()
  @MaxLength(100)
  youtubeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  youtubeChannel?: string;
} 
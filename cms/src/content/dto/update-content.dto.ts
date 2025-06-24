import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { CreateContentDto } from './create-content.dto';

export class UpdateContentDto extends PartialType(CreateContentDto) {
  // All fields from CreateContentDto are now optional
  // This follows the standard NestJS pattern for update DTOs
  
  // Explicitly define commonly updated fields for better validation
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format' })
  publishedAt?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
} 
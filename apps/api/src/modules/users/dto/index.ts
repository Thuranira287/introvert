import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAnonymousMessages?: boolean;
}

export class UserSearchQueryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  skip: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  sortBy?: 'recent' | 'popular';
}

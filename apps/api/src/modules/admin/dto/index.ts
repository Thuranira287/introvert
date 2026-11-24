import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsUUID()
  reportedUserId?: string;

  /** What kind of thing is being reported — 'blog', 'comment', 'user', 'community_post', etc. */
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @IsString()
  @IsNotEmpty()
  entityId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class UpdateReportStatusDto {
  @IsEnum(['PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED'])
  status: 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
}

export class UpdateUserRoleDto {
  @IsEnum(['USER', 'VERIFIED_USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'])
  role: 'USER' | 'VERIFIED_USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
}

export class UpdateCommunityMemberRoleDto {
  @IsEnum(['MEMBER', 'MODERATOR', 'ADMIN'])
  role: 'MEMBER' | 'MODERATOR' | 'ADMIN';
}

export class CancelEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

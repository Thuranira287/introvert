import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto, UpdateCommunityDto, CreateCommunityPostDto } from './dto';

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.create(userId, dto);
  }

  @Public()
  @Get()
  findAll(@Query('search') search?: string) {
    return this.communitiesService.findAll(search);
  }

  @Get('me')
  getMyCommunities(@CurrentUser('id') userId: string) {
    return this.communitiesService.getUserCommunities(userId);
  }

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.communitiesService.findBySlug(slug);
  }

  @Patch(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateCommunityDto) {
    return this.communitiesService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.communitiesService.delete(userId, id);
  }

  @Post(':id/join')
  join(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.communitiesService.join(userId, id);
  }

  @Post(':id/leave')
  leave(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.communitiesService.leave(userId, id);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.communitiesService.getMembers(id);
  }

  @Post(':id/posts')
  createPost(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: CreateCommunityPostDto) {
    return this.communitiesService.createPost(userId, id, dto);
  }

  @Get(':id/posts')
  getPosts(@Param('id') id: string) {
    return this.communitiesService.getPosts(id);
  }
}

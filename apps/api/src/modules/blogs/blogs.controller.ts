import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateBlogDto, UpdateBlogDto, BlogQueryDto } from './dto';

@Controller('blogs')
export class BlogsController {
  private readonly logger = new Logger(BlogsController.name);

  constructor(private readonly blogsService: BlogsService) {}

  @Public()
  @Get()
  async listBlogs(@Query() query: BlogQueryDto) {
    return this.blogsService.listBlogs(query);
  }

  @Public()
  @Get('trending')
  async getTrendingBlogs() {
    return this.blogsService.getTrendingBlogs(10);
  }

  @Public()
  @Get('featured')
  async getFeaturedBlogs() {
    return this.blogsService.getFeaturedBlogs();
  }

  @Public()
  @Get('user/:userId/blogs')
  async getUserBlogs(@Param('userId') userId: string) {
    return this.blogsService.getUserBlogs(userId, true);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBlog(@CurrentUser('id') userId: string, @Body() dto: CreateBlogDto) {
    const blog = await this.blogsService.createBlog(userId, dto);
    this.logger.log(`Blog created by user ${userId}: ${blog.id}`);
    return blog;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/blogs')
  async getMyBlogs(@CurrentUser('id') userId: string) {
    return this.blogsService.getUserBlogs(userId, false);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/bookmarks')
  async getMyBookmarks(@CurrentUser('id') userId: string) {
    return this.blogsService.getUserBookmarks(userId);
  }

  @Public()
  @Get(':slug')
  async getBlogBySlug(@Param('slug') slug: string) {
    return this.blogsService.getBlogBySlug(slug);
  }

  @Public()
  @Get('id/:blogId')
  async getBlogById(@Param('blogId') blogId: string) {
    return this.blogsService.getBlogById(blogId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':blogId')
  async updateBlog(
    @Param('blogId') blogId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateBlogDto,
  ) {
    const blog = await this.blogsService.updateBlog(blogId, userId, dto);
    this.logger.log(`Blog updated: ${blogId}`);
    return blog;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':blogId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlog(@Param('blogId') blogId: string, @CurrentUser('id') userId: string) {
    await this.blogsService.deleteBlog(blogId, userId);
    this.logger.log(`Blog deleted: ${blogId}`);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':blogId/like')
  likeBlog(@Param('blogId') blogId: string, @CurrentUser('id') userId: string) {
    return this.blogsService.likeBlog(blogId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':blogId/bookmark')
  bookmarkBlog(@Param('blogId') blogId: string, @CurrentUser('id') userId: string) {
    return this.blogsService.bookmarkBlog(blogId, userId);
  }
}

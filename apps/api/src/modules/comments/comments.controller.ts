import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('blogs/:blogId/comments')
  create(
    @CurrentUser('id') userId: string,
    @Param('blogId') blogId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(userId, blogId, dto.content, dto.parentId);
  }

  @Public()
  @Get('blogs/:blogId/comments')
  findByBlog(@Param('blogId') blogId: string) {
    return this.commentsService.findByBlog(blogId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('comments/:commentId')
  update(
    @CurrentUser('id') userId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(userId, commentId, dto.content);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  delete(@CurrentUser('id') userId: string, @Param('commentId') commentId: string) {
    return this.commentsService.delete(userId, commentId);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import {
  UpdateReportStatusDto,
  UpdateUserRoleDto,
  UpdateCommunityMemberRoleDto,
  CancelEventDto,
} from './dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get('stats/signups')
  getSignupTrend(@Query('days') days?: number) {
    return this.adminService.getSignupTrend(days ? Number(days) : 30);
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get('users')
  listUsers(@Query('skip') skip?: number, @Query('take') take?: number, @Query('search') search?: string) {
    return this.adminService.listUsers({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      search,
    });
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Patch('users/:userId/role')
  updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(adminId, userId, dto.role);
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Post('users/:userId/verify')
  grantVerification(@CurrentUser('id') adminId: string, @Param('userId') userId: string) {
    return this.adminService.grantVerification(adminId, userId);
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Delete('users/:userId/verify')
  revokeVerification(@CurrentUser('id') adminId: string, @Param('userId') userId: string) {
    return this.adminService.revokeVerification(adminId, userId);
  }

  @Post('users/:userId/suspend')
  suspendUser(@CurrentUser('id') adminId: string, @Param('userId') userId: string) {
    return this.adminService.suspendUser(adminId, userId);
  }

  @Post('users/:userId/reactivate')
  reactivateUser(@CurrentUser('id') adminId: string, @Param('userId') userId: string) {
    return this.adminService.reactivateUser(adminId, userId);
  }

  @Get('reports')
  listReports(@Query('status') status?: string) {
    return this.adminService.listReports(status);
  }

  @Patch('reports/:reportId')
  updateReportStatus(
    @CurrentUser('id') adminId: string,
    @Param('reportId') reportId: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.adminService.updateReportStatus(adminId, reportId, dto.status);
  }

  @Delete('blogs/:blogId')
  removeBlog(@CurrentUser('id') adminId: string, @Param('blogId') blogId: string) {
    return this.adminService.removeBlog(adminId, blogId);
  }

  @Delete('comments/:commentId')
  removeComment(@CurrentUser('id') adminId: string, @Param('commentId') commentId: string) {
    return this.adminService.removeComment(adminId, commentId);
  }

  @Get('communities')
  listCommunities(@Query('skip') skip?: number, @Query('take') take?: number, @Query('search') search?: string) {
    return this.adminService.listCommunities({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      search,
    });
  }

  @Delete('communities/:communityId')
  removeCommunity(@CurrentUser('id') adminId: string, @Param('communityId') communityId: string) {
    return this.adminService.removeCommunity(adminId, communityId);
  }

  @Delete('communities/posts/:postId')
  removeCommunityPost(@CurrentUser('id') adminId: string, @Param('postId') postId: string) {
    return this.adminService.removeCommunityPost(adminId, postId);
  }

  @Patch('communities/:communityId/members/:userId/role')
  setCommunityMemberRole(
    @CurrentUser('id') adminId: string,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateCommunityMemberRoleDto,
  ) {
    return this.adminService.setCommunityMemberRole(adminId, communityId, userId, dto.role);
  }

  @Delete('communities/:communityId/members/:userId')
  removeCommunityMember(
    @CurrentUser('id') adminId: string,
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.removeCommunityMember(adminId, communityId, userId);
  }

  @Get('events')
  listEvents(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('search') search?: string,
    @Query('includePast') includePast?: string,
  ) {
    return this.adminService.listEvents({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      search,
      includePast: includePast === 'true',
    });
  }

  @Post('events/:eventId/cancel')
  cancelEvent(
    @CurrentUser('id') adminId: string,
    @Param('eventId') eventId: string,
    @Body() dto: CancelEventDto,
  ) {
    return this.adminService.cancelEvent(adminId, eventId, dto.reason);
  }

  @Delete('events/:eventId')
  removeEvent(@CurrentUser('id') adminId: string, @Param('eventId') eventId: string) {
    return this.adminService.removeEvent(adminId, eventId);
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get('audit-logs')
  getAuditLogs(@Query('skip') skip?: number, @Query('take') take?: number) {
    return this.adminService.getAuditLogs(skip ? Number(skip) : 0, take ? Number(take) : 50);
  }
}

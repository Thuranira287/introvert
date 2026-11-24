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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateUserProfileDto, UserSearchQueryDto } from './dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Get('search')
  async searchUsers(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.usersService.searchUsers(query, limit ? Number(limit) : 20);
  }

  @Public()
  @Get('trending')
  async getTrendingUsers(@Query('limit') limit?: number) {
    return this.usersService.getTrendingUsers(limit ? Number(limit) : 10);
  }

  @Public()
  @Post('check-username')
  async checkUsernameAvailability(@Body() body: { username: string }) {
    const available = await this.usersService.checkUsernameAvailability(body.username);
    return { available, message: available ? 'Username is available' : 'Username is taken' };
  }

  @Public()
  @Post('check-email')
  async checkEmailAvailability(@Body() body: { email: string }) {
    const available = await this.usersService.checkEmailAvailability(body.email);
    return { available, message: available ? 'Email is available' : 'Email is already registered' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/profile')
  async getCurrentUser(@CurrentUser('id') userId: string) {
    const user = await this.usersService.findById(userId);
    const stats = await this.usersService.getUserStats(userId);
    return { ...user, stats };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateUserProfileDto) {
    const profile = await this.usersService.updateProfile(userId, dto);
    this.logger.log(`Profile updated for user: ${userId}`);
    return profile;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  async getUserStats(@CurrentUser('id') userId: string) {
    return this.usersService.getUserStats(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/suggested')
  async getSuggestedUsers(@CurrentUser('id') userId: string, @Query('limit') limit?: number) {
    return this.usersService.getSuggestedUsers(userId, limit ? Number(limit) : 10);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateAccount(@CurrentUser('id') userId: string) {
    await this.usersService.deactivate(userId);
    this.logger.log(`Account deactivated for user: ${userId}`);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  follow(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.usersService.follow(userId, targetId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  unfollow(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.usersService.unfollow(userId, targetId);
  }

  // Requires auth (rather than @Public()) so we can resolve `isFollowing`
  // for the viewer — a @Public() route never populates req.user, since the
  // JwtAuthGuard short-circuits before JwtStrategy.validate() runs.

  @UseGuards(JwtAuthGuard)
  @Get(':username')
  async getUserByUsername(@Param('username') username: string, @CurrentUser('id') viewerId: string) {
    return this.usersService.findByUsername(username, viewerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Get()
  async getAllUsers(@Query() query: UserSearchQueryDto) {
    return this.usersService.findMany(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hardDeleteUser(@Param('userId') userId: string) {
    await this.usersService.hardDelete(userId);
    this.logger.warn(`User hard deleted by super admin: ${userId}`);
  }
}

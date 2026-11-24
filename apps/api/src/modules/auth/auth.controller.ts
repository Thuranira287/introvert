import { Body, Controller, Get, Post, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto';

/** Per-IP request limits for credential endpoints, to blunt brute-force and enumeration attempts. */
const limit = (requests: number) => ({ default: { limit: requests, ttl: 60_000 } });

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(limit(5))
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle(limit(10))
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  @Public()
  @Throttle(limit(3))
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(limit(5))
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Throttle(limit(10))
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(limit(3))
  @Post('resend-verification')
  resendVerification(@CurrentUser('id') userId: string) {
    return this.authService.resendVerification(userId);
  }

  // Redirect-based flow: the browser is sent to Google, Google redirects
  // back to our callback with the profile attached by GoogleStrategy, and
  // we redirect once more to the frontend with tokens in the URL fragment
  // (not query string) so they aren't logged by servers/proxies along the way.

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {
    // Intentionally empty — GoogleAuthGuard handles the redirect to Google.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('CORS_ORIGIN')?.split(',')[0] || 'http://localhost:3000';

    try {
      const result = await this.authService.loginWithGoogle(req.user);
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: String(result.isNewUser),
      });
      res.redirect(`${frontendUrl}/auth/callback#${params.toString()}`);
    } catch (error) {
      this.logger.warn(`Google sign-in failed: ${(error as Error).message}`);
      res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }

  /**
   * Mobile counterpart to the web redirect flow above. The Expo app
   * completes Google's consent screen itself (via expo-auth-session) and
   * sends us just the resulting ID token — no redirect, no cookies, no
   * frontend URL involved.
   */
  @Public()
  @Post('google/mobile')
  googleMobileLogin(@Body() dto: { idToken: string }) {
    return this.authService.loginWithGoogleIdToken(dto.idToken);
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto';
import { EmailService } from '../email/email.service';
import { hashToken } from './token-hash';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {
    // A single OAuth2Client can verify ID tokens issued for any of your
    // app's client IDs (web, iOS, Android) — verifyIdToken checks the
    // token's `aud` claim against whichever list you pass it per call.
    this.googleClient = new OAuth2Client();
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'username';
      throw new ConflictException(`User with this ${field} already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        displayName: dto.displayName,
        passwordHash,
        profile: { create: {} },
      },
      include: { profile: true },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.username, user.role);

    await this.sendVerificationEmail(user.id, user.email);

    this.logger.log(`User registered: ${user.id}`);
    return { user: this.sanitize(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.username, user.role);

    return { user: this.sanitize(user), ...tokens };
  }

  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke the used token and issue a new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(stored.user.id, stored.user.email, stored.user.username, stored.user.role);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: hashToken(refreshToken) },
      data: { revoked: true },
    });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Invalidate all existing refresh tokens on password change
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });

    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return this.sanitize(user);
  }

  /**
   * Always reports success whether or not the email exists, so the endpoint
   * cannot be used to discover registered addresses. Only a hash of the token
   * is stored; the raw token exists solely in the emailed link.
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex');

      await this.prisma.$transaction([
        this.prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        this.prisma.passwordResetToken.create({
          data: { token: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
        }),
      ]);

      await this.emailService.sendPasswordReset(user.email, `${this.getFrontendUrl()}/reset-password?token=${token}`);
    }

    return { success: true, message: 'If that email is registered, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { token: hashToken(token) } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: resetToken.userId }, data: { revoked: true } }),
    ]);

    return { success: true };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { token: hashToken(token) } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { isEmailVerified: true } }),
      this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    return { success: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.isEmailVerified) {
      await this.sendVerificationEmail(user.id, user.email);
    }
    return { success: true };
  }

  /** Never throws: a failure to prepare or send the email must not fail registration. */
  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      await this.prisma.$transaction([
        this.prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
        this.prisma.emailVerificationToken.create({
          data: { token: hashToken(token), userId, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS) },
        }),
      ]);
      await this.emailService.sendEmailVerification(email, `${this.getFrontendUrl()}/verify-email?token=${token}`);
    } catch (error) {
      this.logger.error(`Could not issue a verification email for user ${userId}`, (error as Error).stack);
    }
  }

  /**
   * Finds or creates a user from a verified Google profile, then issues our
   * own JWT pair — Google's tokens are never stored or reused beyond this
   * one lookup. An existing password-based account with the same email is
   * linked to the Google account rather than duplicated.
   */
  async loginWithGoogle(googleProfile: { googleId: string; email: string; displayName: string; avatarUrl?: string }) {
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: 'google', providerUserId: googleProfile.googleId } },
      include: { user: { include: { profile: true } } },
    });

    if (existingOAuth) {
      await this.prisma.user.update({ where: { id: existingOAuth.userId }, data: { lastLoginAt: new Date() } });
      const tokens = await this.issueTokens(
        existingOAuth.user.id,
        existingOAuth.user.email,
        existingOAuth.user.username,
        existingOAuth.user.role,
      );
      return { user: this.sanitize(existingOAuth.user), ...tokens, isNewUser: false };
    }

    // No OAuth link yet — check if an account with this email already
    // exists (e.g. they originally signed up with a password) and link it,
    // otherwise create a brand new account.
    let user = await this.prisma.user.findUnique({ where: { email: googleProfile.email }, include: { profile: true } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const username = await this.generateUsernameFromEmail(googleProfile.email);

      user = await this.prisma.user.create({
        data: {
          email: googleProfile.email,
          username,
          displayName: googleProfile.displayName,
          isEmailVerified: true, // Google has already verified this email
          profile: { create: { avatarUrl: googleProfile.avatarUrl } },
        },
        include: { profile: true },
      });
    }

    await this.prisma.oAuthAccount.create({
      data: { userId: user.id, provider: 'google', providerUserId: googleProfile.googleId },
    });

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokens(user.id, user.email, user.username, user.role);
    return { user: this.sanitize(user), ...tokens, isNewUser };
  }

  private async generateUsernameFromEmail(email: string): Promise<string> {
    const base = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) || 'user';

    let username = base;
    let suffix = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${base}${suffix++}`;
    }
    return username;
  }

  /**
   * Mobile/native Google Sign-In: the client (Expo app) completes the
   * Google consent flow itself via expo-auth-session and sends us the
   * resulting ID token. We verify it against Google's public keys — the
   * `aud` claim must match one of our registered client IDs (web, iOS, or
   * Android), so a token issued for an unrelated app can't be replayed here.
   */
  async loginWithGoogleIdToken(idToken: string) {
    const webClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const iosClientId = this.config.get<string>('GOOGLE_IOS_CLIENT_ID');
    const androidClientId = this.config.get<string>('GOOGLE_ANDROID_CLIENT_ID');
    const validAudiences = [webClientId, iosClientId, androidClientId].filter(Boolean) as string[];

    if (validAudiences.length === 0) {
      throw new UnauthorizedException('Google sign-in is not configured on this server');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: validAudiences });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.debug(`Google ID token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google token did not include the expected profile fields');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return this.loginWithGoogle({
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email.split('@')[0],
      avatarUrl: payload.picture,
    });
  }

  private getFrontendUrl(): string {
    const configured = this.config.get<string>('FRONTEND_URL') || this.config.get<string>('CORS_ORIGIN')?.split(',')[0];
    return (configured || 'http://localhost:3000').replace(/\/+$/, '');
  }

  private async issueTokens(userId: string, email: string, username: string, role: string) {
    const payload = { sub: userId, email, username, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
      expiresIn: '15m',
    });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prisma.refreshToken.create({
      data: { token: hashToken(refreshToken), userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private sanitize(user: any) {
    const { passwordHash, twoFactorSecret, ...safe } = user;
    return safe;
  }
}

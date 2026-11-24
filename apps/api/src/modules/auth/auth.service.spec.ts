import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { hashToken } from './token-hash';

describe('AuthService', () => {
  let service: AuthService;
  let emailService: { sendPasswordReset: jest.Mock; sendEmailVerification: jest.Mock };
  let prisma: {
    user: Record<string, jest.Mock>;
    refreshToken: Record<string, jest.Mock>;
    passwordResetToken: Record<string, jest.Mock>;
    emailVerificationToken: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      emailVerificationToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    emailService = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => ({ JWT_SECRET: 'test-secret', FRONTEND_URL: 'https://app.example.com/' })[key],
          },
        },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      username: 'newuser',
      displayName: 'New User',
      password: 'password123',
    };

    it('throws ConflictException when the email is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: '1', email: dto.email, username: 'someoneelse' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the username is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: '1', email: 'other@example.com', username: dto.username });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('hashes the password and never returns it to the caller', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'u1', ...data, profile: {} }),
      );
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(prisma.user.create).toHaveBeenCalled();
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, createCall.data.passwordHash)).toBe(true);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for a non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'nope@example.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for an incorrect password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        passwordHash,
        isActive: true,
        role: 'USER',
        username: 'user',
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a deactivated account even with the correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        passwordHash,
        isActive: false,
        role: 'USER',
        username: 'user',
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'correct-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('succeeds and issues tokens for correct credentials on an active account', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        passwordHash,
        isActive: true,
        role: 'USER',
        username: 'user',
        profile: {},
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'user@example.com', password: 'correct-password' });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword', () => {
    it('throws UnauthorizedException when the current password is wrong', async () => {
      const passwordHash = await bcrypt.hash('actual-password', 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash });

      await expect(
        service.changePassword('u1', { currentPassword: 'wrong', newPassword: 'newpassword123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('revokes all existing refresh tokens after a successful change', async () => {
      const passwordHash = await bcrypt.hash('actual-password', 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.changePassword('u1', { currentPassword: 'actual-password', newPassword: 'newpassword123' });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { revoked: true },
      });
    });
  });

  describe('refreshToken', () => {
    it('throws UnauthorizedException for an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('unknown-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        token: 'expired-token',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'u1', email: 'e', username: 'u', role: 'USER' },
      });

      await expect(service.refreshToken('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an already-revoked token (reuse detection)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        token: 'reused-token',
        revoked: true,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', email: 'e', username: 'u', role: 'USER' },
      });

      await expect(service.refreshToken('reused-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the token: revokes the old one and issues a new pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        token: 'valid-token',
        revoked: false,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'u1', email: 'e@x.com', username: 'u', role: 'USER' },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.refreshToken('valid-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt1' },
        data: { revoked: true },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('token storage', () => {
    it('stores only a hash of the refresh token it hands to the client', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        passwordHash,
        isActive: true,
        role: 'USER',
        username: 'user',
        profile: {},
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'user@example.com', password: 'correct-password' });

      const stored = prisma.refreshToken.create.mock.calls[0][0].data.token;
      expect(stored).not.toBe(result.refreshToken);
      expect(stored).toBe(hashToken(result.refreshToken));
    });

    it('looks refresh tokens up by hash when refreshing', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('raw-token')).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: hashToken('raw-token') } }),
      );
    });

    it('revokes by hash on logout', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('raw-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: hashToken('raw-token') },
        data: { revoked: true },
      });
    });
  });

  describe('forgotPassword', () => {
    const genericResponse = expect.objectContaining({ success: true });

    it('responds identically for an unknown email and sends nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.forgotPassword('nobody@example.com')).resolves.toEqual(genericResponse);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('sends nothing to a suspended account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@example.com', isActive: false });

      await service.forgotPassword('a@example.com');

      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('stores a hash, emails the raw token, and invalidates earlier links', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@example.com', isActive: true });

      await expect(service.forgotPassword('a@example.com')).resolves.toEqual(genericResponse);

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      const [to, link] = emailService.sendPasswordReset.mock.calls[0];
      expect(to).toBe('a@example.com');
      const rawToken = new URL(link).searchParams.get('token') as string;
      expect(link.startsWith('https://app.example.com/reset-password?token=')).toBe(true);

      const stored = prisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(stored.token).toBe(hashToken(rawToken));
      expect(stored.token).not.toBe(rawToken);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('resetPassword', () => {
    const validRecord = () => ({
      id: 'r1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it('rejects an unknown token, looking it up by hash', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('raw', 'new-password-123')).rejects.toThrow(UnauthorizedException);
      expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { token: hashToken('raw') } });
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({ ...validRecord(), expiresAt: new Date(Date.now() - 1000) });

      await expect(service.resetPassword('raw', 'new-password-123')).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token that was already used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({ ...validRecord(), usedAt: new Date() });

      await expect(service.resetPassword('raw', 'new-password-123')).rejects.toThrow(UnauthorizedException);
    });

    it('sets the new password, consumes the token, and signs out every session', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());

      await service.resetPassword('raw', 'new-password-123');

      const update = prisma.user.update.mock.calls[0][0];
      expect(update.where).toEqual({ id: 'u1' });
      expect(await bcrypt.compare('new-password-123', update.data.passwordHash)).toBe(true);
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { revoked: true },
      });
    });
  });

  describe('email verification', () => {
    const registration = { email: 'new@example.com', username: 'newuser', displayName: 'New User', password: 'password123' };

    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data, profile: {} }));
      prisma.refreshToken.create.mockResolvedValue({});
    });

    it('emails a verification link, storing only its hash', async () => {
      await service.register(registration);

      const [to, link] = emailService.sendEmailVerification.mock.calls[0];
      expect(to).toBe('new@example.com');
      expect(link.startsWith('https://app.example.com/verify-email?token=')).toBe(true);

      const rawToken = new URL(link).searchParams.get('token') as string;
      const stored = prisma.emailVerificationToken.create.mock.calls[0][0].data;
      expect(stored.token).toBe(hashToken(rawToken));
      expect(stored.token).not.toBe(rawToken);
    });

    it('still completes registration when the verification email cannot be prepared', async () => {
      prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      try {
        const result = await service.register(registration);

        expect(result).toHaveProperty('accessToken');
        expect(emailService.sendEmailVerification).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('verification email'), expect.any(String));
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('rejects an unknown token, looking it up by hash', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('raw')).rejects.toThrow(BadRequestException);
      expect(prisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({ where: { token: hashToken('raw') } });
    });

    it.each([
      ['expired', { expiresAt: new Date(Date.now() - 1000), usedAt: null }],
      ['already used', { expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() }],
    ])('rejects a token that is %s', async (_label, fields) => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({ id: 'v1', userId: 'u1', ...fields });

      await expect(service.verifyEmail('raw')).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('marks the email verified and consumes the token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'v1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.verifyEmail('raw')).resolves.toEqual({ success: true });

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isEmailVerified: true } });
      expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('resends only to accounts that are not yet verified', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@example.com', isEmailVerified: false });
      await service.resendVerification('u1');
      expect(emailService.sendEmailVerification).toHaveBeenCalledTimes(1);

      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@example.com', isEmailVerified: true });
      await service.resendVerification('u1');
      expect(emailService.sendEmailVerification).toHaveBeenCalledTimes(1);
    });
  });
});

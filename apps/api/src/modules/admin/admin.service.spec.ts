import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    user: Record<string, jest.Mock>;
    refreshToken: Record<string, jest.Mock>;
    auditLog: Record<string, jest.Mock>;
    community: Record<string, jest.Mock>;
    event: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
      community: { findUnique: jest.fn(), delete: jest.fn() },
      event: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('updateUserRole', () => {
    it('throws NotFoundException when the acting admin cannot be found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.updateUserRole('missing-admin', 'target', 'MODERATOR')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets a plain ADMIN grant MODERATOR to a regular user', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' }) // acting admin
        .mockResolvedValueOnce({ id: 'target1', role: 'USER' }); // target
      prisma.user.update.mockResolvedValue({ id: 'target1', role: 'MODERATOR' });
      prisma.auditLog.create.mockResolvedValue({});

      await service.updateUserRole('admin1', 'target1', 'MODERATOR');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'target1' }, data: { role: 'MODERATOR' } }),
      );
    });

    it('BLOCKS a plain ADMIN from granting the ADMIN role (only SUPER_ADMIN can)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' });

      await expect(service.updateUserRole('admin1', 'target1', 'ADMIN')).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('BLOCKS a plain ADMIN from granting SUPER_ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' });

      await expect(service.updateUserRole('admin1', 'target1', 'SUPER_ADMIN')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('BLOCKS a plain ADMIN from modifying an existing ADMIN, even to demote them', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' })
        .mockResolvedValueOnce({ id: 'admin2', role: 'ADMIN' });

      await expect(service.updateUserRole('admin1', 'admin2', 'USER')).rejects.toThrow(ForbiddenException);
    });

    it('ALLOWS a SUPER_ADMIN to grant ADMIN', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'superadmin1', role: 'SUPER_ADMIN' })
        .mockResolvedValueOnce({ id: 'target1', role: 'USER' });
      prisma.user.update.mockResolvedValue({ id: 'target1', role: 'ADMIN' });

      await service.updateUserRole('superadmin1', 'target1', 'ADMIN');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'target1' }, data: { role: 'ADMIN' } }),
      );
    });
  });

  describe('suspendUser', () => {
    it('BLOCKS suspending another admin through this endpoint', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin2', role: 'ADMIN' });

      await expect(service.suspendUser('admin1', 'admin2')).rejects.toThrow(ForbiddenException);
    });

    it('suspends a regular user and revokes their sessions', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER' });
      prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.suspendUser('admin1', 'u1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: { isActive: false } }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { revoked: true },
      });
    });
  });


  describe('credential safety', () => {
    const forbidden = ['passwordHash', 'twoFactorSecret'];

    function selectedFields(): string[] {
      const call = prisma.user.update.mock.calls[0][0];
      expect(call.select).toBeDefined();
      return Object.keys(call.select);
    }

    it('never selects credential fields when changing a role', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'a1', role: 'SUPER_ADMIN' })
        .mockResolvedValueOnce({ id: 't1', role: 'USER' });
      prisma.user.update.mockResolvedValue({ id: 't1' });

      await service.updateUserRole('a1', 't1', 'MODERATOR');

      expect(selectedFields()).not.toEqual(expect.arrayContaining(forbidden));
    });

    it('never selects credential fields when suspending a user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER' });
      prisma.user.update.mockResolvedValue({ id: 'u1' });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await service.suspendUser('a1', 'u1');

      expect(selectedFields()).not.toEqual(expect.arrayContaining(forbidden));
    });

    it('never selects credential fields when granting verification', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.user.update.mockResolvedValue({ id: 'u1' });

      await service.grantVerification('a1', 'u1');

      expect(selectedFields()).not.toEqual(expect.arrayContaining(forbidden));
    });

    it('never selects credential fields when revoking verification', async () => {
      prisma.user.update.mockResolvedValue({ id: 'u1' });

      await service.revokeVerification('a1', 'u1');

      expect(selectedFields()).not.toEqual(expect.arrayContaining(forbidden));
    });
  });

  describe('verification', () => {
    it('throws NotFoundException when granting to a non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.grantVerification('a1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('marks the user as admin-verified and writes an audit entry', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.user.update.mockResolvedValue({ id: 'u1', isVerified: true });

      await service.grantVerification('a1', 'u1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isVerified: true, verificationType: 'ADMIN_GRANTED' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('cancelEvent', () => {
    it('throws NotFoundException for a non-existent event', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.cancelEvent('admin1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('cancels the event regardless of who organized it (admin override)', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Book Club', organizerId: 'someone-else' });
      prisma.event.update.mockResolvedValue({ id: 'e1', status: 'CANCELLED' });

      const result = await service.cancelEvent('admin1', 'e1', 'Violates community guidelines');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('removeCommunity', () => {
    it('throws NotFoundException for a non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null);

      await expect(service.removeCommunity('admin1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('removes the community and writes an audit log entry', async () => {
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', name: 'Book Lovers' });
      prisma.community.delete.mockResolvedValue({});

      await service.removeCommunity('admin1', 'c1');

      expect(prisma.community.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'community.removed', userId: 'admin1' }),
        }),
      );
    });
  });
});

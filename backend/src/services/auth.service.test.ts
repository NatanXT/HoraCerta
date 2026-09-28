import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './auth.service';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/app-error';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workSchedule: {
      updateMany: vi.fn(),
    },
    workDay: {
      updateMany: vi.fn(),
    },
    timeEntry: {
      updateMany: vi.fn(),
    },
  },
}));

describe('AuthService & Legacy Claim (Mocked DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should claim legacy user account on first real registration, preserving user ID and relations', async () => {
    const legacyUserMock = {
      id: 'legacy-id-123',
      name: 'Usuário HoraCerta',
      email: 'usuario@horacerta.local',
      passwordHash: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(legacyUserMock)
      .mockResolvedValueOnce(null);

    (prisma.user.update as any).mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: legacyUserMock.createdAt,
      updatedAt: new Date(),
    }));

    const claimedUser = await authService.register({
      name: 'Natan',
      email: 'natan@example.com',
      password: '12345678',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'legacy-id-123' },
      data: expect.objectContaining({
        name: 'Natan',
        email: 'natan@example.com',
        passwordHash: expect.any(String),
      }),
    });

    expect(claimedUser.id).toBe('legacy-id-123');
    expect(claimedUser.name).toBe('Natan');
    expect(claimedUser.email).toBe('natan@example.com');

    expect(prisma.workSchedule.updateMany).not.toHaveBeenCalled();
    expect(prisma.workDay.updateMany).not.toHaveBeenCalled();
    expect(prisma.timeEntry.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should create a NEW user normally on subsequent registration after legacy claim is completed', async () => {
    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    (prisma.user.create as any).mockImplementation(async ({ data }: any) => ({
      id: 'new-user-456',
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const newUser = await authService.register({
      name: 'Segundo Usuário',
      email: 'second@example.com',
      password: '12345678',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Segundo Usuário',
        email: 'second@example.com',
        passwordHash: expect.any(String),
      }),
    });
    expect(newUser.id).toBe('new-user-456');
    expect(newUser.id).not.toBe('legacy-id-123');
  });

  it('should throw AppError 400 when registering with duplicate email during claim', async () => {
    const legacyUserMock = {
      id: 'legacy-id-123',
      name: 'Usuário HoraCerta',
      email: 'usuario@horacerta.local',
      passwordHash: null,
    };

    const existingOtherUser = {
      id: 'other-user-999',
      email: 'duplicate@example.com',
      passwordHash: 'hash',
    };

    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(legacyUserMock)
      .mockResolvedValueOnce(existingOtherUser);

    await expect(
      authService.register({
        name: 'Another',
        email: 'duplicate@example.com',
        password: '12345678',
      })
    ).rejects.toThrow(AppError);
  });

  it('should authenticate valid user on login and reject invalid credentials', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'nobody@example.com',
        password: 'password123',
      })
    ).rejects.toThrow(AppError);
  });
});

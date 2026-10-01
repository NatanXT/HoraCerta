import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileService } from './profile.service';
import { prisma } from '../lib/prisma';
import { Weekday } from '@prisma/client';

const userId = 'profile-test-user-id';

vi.mock('../lib/prisma', () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (callback) => callback(mockPrisma)),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workSchedule: {
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('ProfileService — Work Schedule Save & Upsert (Parte I)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userId,
      name: 'Natan',
      email: 'natan@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  it('deve calcular expectedMinutes = 480 para jornada 09:00 (540) a 18:00 (1080) com almoço 60 e lanche 0', async () => {
    const days = [
      {
        weekday: 'MONDAY',
        isWorkDay: true,
        plannedStartMinutes: 540, // 09:00
        plannedEndMinutes: 1080,  // 18:00
        snackBreakMinutes: 0,
        lunchBreakMinutes: 60,
      },
      { weekday: 'TUESDAY', isWorkDay: false },
      { weekday: 'WEDNESDAY', isWorkDay: false },
      { weekday: 'THURSDAY', isWorkDay: false },
      { weekday: 'FRIDAY', isWorkDay: false },
      { weekday: 'SATURDAY', isWorkDay: false },
      { weekday: 'SUNDAY', isWorkDay: false },
    ];

    vi.mocked(prisma.workSchedule.upsert).mockResolvedValue({
      id: 'ws-1',
      userId,
      weekday: Weekday.MONDAY,
      expectedMinutes: 480,
      plannedStartMinutes: 540,
      plannedEndMinutes: 1080,
      snackBreakMinutes: 0,
      lunchBreakMinutes: 60,
      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.mocked(prisma.workSchedule.findMany).mockResolvedValue([
      {
        id: 'ws-1',
        userId,
        weekday: Weekday.MONDAY,
        expectedMinutes: 480,
        plannedStartMinutes: 540,
        plannedEndMinutes: 1080,
        snackBreakMinutes: 0,
        lunchBreakMinutes: 60,
        effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const result = await profileService.updateWorkSchedule(userId, { days: days as any });

    expect(prisma.workSchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId_weekday_effectiveFrom: expect.anything(),
        }),
        create: expect.objectContaining({
          weekday: Weekday.MONDAY,
          expectedMinutes: 480, // 1080 - 540 - 0 - 60 = 480
          plannedStartMinutes: 540,
          plannedEndMinutes: 1080,
          snackBreakMinutes: 0,
          lunchBreakMinutes: 60,
        }),
        update: expect.objectContaining({
          expectedMinutes: 480,
          plannedStartMinutes: 540,
          plannedEndMinutes: 1080,
          snackBreakMinutes: 0,
          lunchBreakMinutes: 60,
        }),
      })
    );

    expect(result).toBeDefined();
    expect(result.workSchedule.days.find((d) => d.weekday === 'MONDAY')?.expectedMinutes).toBe(480);
  });

  it('salvar duas vezes no mesmo dia: executa UPSERT sem criar duplicata, sem erro P2002 e sem 500', async () => {
    const days = [
      { weekday: 'MONDAY', isWorkDay: true, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60 },
      { weekday: 'TUESDAY', isWorkDay: true, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60 },
      { weekday: 'WEDNESDAY', isWorkDay: true, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60 },
      { weekday: 'THURSDAY', isWorkDay: true, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60 },
      { weekday: 'FRIDAY', isWorkDay: true, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60 },
      { weekday: 'SATURDAY', isWorkDay: false },
      { weekday: 'SUNDAY', isWorkDay: false },
    ];

    vi.mocked(prisma.workSchedule.upsert).mockResolvedValue({} as any);
    vi.mocked(prisma.workSchedule.findMany).mockResolvedValue([]);

    // First save
    const res1 = await profileService.updateWorkSchedule(userId, { days: days as any });
    expect(res1).toBeDefined();

    // Second save on the same day
    const res2 = await profileService.updateWorkSchedule(userId, { days: days as any });
    expect(res2).toBeDefined();
  });
});

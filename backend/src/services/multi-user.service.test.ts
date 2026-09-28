import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workDayService } from './work-day.service';
import { bankHoursService } from './bank-hours.service';
import { calendarOccurrenceService } from './calendar-occurrence.service';
import { reportService } from './report.service';
import { prisma } from '../lib/prisma';
import { CalendarOccurrenceType } from '@prisma/client';

vi.mock('../lib/prisma', () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (callback) => callback(mockPrisma)),
    calendarOccurrence: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    timeEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workDay: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    bankHoursConfig: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    workDayAdjustment: {
      create: vi.fn(),
    },
    workSchedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    workBreak: {
      findMany: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Multi-User Data Isolation Safety (Mocked DB)', () => {
  const userAId = 'user-a-id';
  const userBId = 'user-b-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('User A must NOT see or access User B records across all services', async () => {
    // 1. Calendar Occurrence
    vi.mocked(prisma.calendarOccurrence.create).mockResolvedValue({
      id: 'occ-b-1',
      userId: userBId,
      type: CalendarOccurrenceType.VACATION,
      title: 'Férias User B',
      startDate: new Date('2026-10-10T00:00:00.000Z'),
      endDate: new Date('2026-10-20T00:00:00.000Z'),
      note: null,
      deletedAt: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    vi.mocked(prisma.calendarOccurrence.findMany).mockResolvedValue([]);

    await calendarOccurrenceService.create(userBId, {
      type: CalendarOccurrenceType.VACATION,
      title: 'Férias User B',
      startDate: '2026-10-10',
      endDate: '2026-10-20',
    });

    const listA = await calendarOccurrenceService.list(userAId, '2026-10-01', '2026-10-31');
    expect(listA.length).toBe(0);
    expect(prisma.calendarOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: userAId }),
      })
    );

    // 2. WorkDay / Today Summary
    vi.mocked(prisma.workDay.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.workSchedule.findFirst).mockResolvedValue(null);

    const todayA = await workDayService.getTodaySummary(userAId);
    expect(todayA.entries.length).toBe(0);

    // 3. Bank Hours Config
    vi.mocked(prisma.bankHoursConfig.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.workDay.findFirst).mockResolvedValue(null);

    const bankA = await bankHoursService.getBankHoursStatus(userAId);
    expect(bankA.configured).toBe(false);

    // 4. Reports isolation
    vi.mocked(prisma.workSchedule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.workDay.findMany).mockResolvedValue([]);

    const reportA = await reportService.getWorkHoursReport(userAId, '2026-09-01', '2026-09-30');
    expect(reportA.days.filter((d) => d.entries.length > 0).length).toBe(0);
  });
});

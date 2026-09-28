import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  workSessionService,
  resolveWorkSessionState,
} from './work-session.service';
import { prisma } from '../lib/prisma';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { AppError } from '../errors/app-error';

const userId = 'session-user-id';

vi.mock('../lib/prisma', () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (callback) => callback(mockPrisma)),
    calendarOccurrence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    workSchedule: {
      findFirst: vi.fn(),
    },
    workBreak: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    timeEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workDay: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('WorkSessionService - State Machine & Atomic Operations (Mocked DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveWorkSessionState Unit Rules', () => {
    it('1. NOT_STARTED when no entries and no active breaks', () => {
      const res = resolveWorkSessionState([], []);
      expect(res.state).toBe('NOT_STARTED');
      expect(res.activeBreak).toBeNull();
    });

    it('2. WORKING when last entry is CLOCK_IN and no active breaks', () => {
      const entries = [
        { id: '1', workDayId: 'wd1', type: 'CLOCK_IN', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const res = resolveWorkSessionState(entries as any, []);
      expect(res.state).toBe('WORKING');
    });

    it('3. ON_LUNCH_BREAK when last entry is CLOCK_OUT and 1 active LUNCH break', () => {
      const entries = [
        { id: '1', workDayId: 'wd1', type: 'CLOCK_IN', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', workDayId: 'wd1', type: 'CLOCK_OUT', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const breaks = [
        { id: 'b1', workDayId: 'wd1', type: 'LUNCH', startedAt: new Date(), endedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const res = resolveWorkSessionState(entries as any, breaks as any);
      expect(res.state).toBe('ON_LUNCH_BREAK');
      expect(res.activeBreak?.id).toBe('b1');
    });

    it('4. ENDED when last entry is CLOCK_OUT and no active breaks', () => {
      const entries = [
        { id: '1', workDayId: 'wd1', type: 'CLOCK_IN', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', workDayId: 'wd1', type: 'CLOCK_OUT', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const breaks = [
        { id: 'b1', workDayId: 'wd1', type: 'LUNCH', startedAt: new Date(), endedAt: new Date(), deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const res = resolveWorkSessionState(entries as any, breaks as any);
      expect(res.state).toBe('ENDED');
      expect(res.activeBreak).toBeNull();
    });

    it('5. Throw WORK_SESSION_INCONSISTENT when break is open but last entry is CLOCK_IN', () => {
      const entries = [
        { id: '1', workDayId: 'wd1', type: 'CLOCK_IN', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const breaks = [
        { id: 'b1', workDayId: 'wd1', type: 'LUNCH', startedAt: new Date(), endedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      expect(() => resolveWorkSessionState(entries as any, breaks as any)).toThrow(AppError);
    });
    it('6. ON_SNACK_BREAK when last entry is CLOCK_OUT and 1 active SNACK break', () => {
      const entries = [
        { id: '1', workDayId: 'wd1', type: 'CLOCK_IN', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', workDayId: 'wd1', type: 'CLOCK_OUT', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const breaks = [
        { id: 'b1', workDayId: 'wd1', type: 'SNACK', startedAt: new Date(), endedAt: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const res = resolveWorkSessionState(entries as any, breaks as any);
      expect(res.state).toBe('ON_SNACK_BREAK');
      expect(res.activeBreak?.id).toBe('b1');
    });

    it('7. Throw WORK_SESSION_INCONSISTENT when more than 1 active break exists', () => {
      const entries = [
        { id: '1', workDayId: 'wd1', type: 'CLOCK_IN', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', workDayId: 'wd1', type: 'CLOCK_OUT', timestamp: new Date(), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const breaks = [
        { id: 'b1', workDayId: 'wd1', type: 'SNACK', startedAt: new Date(), endedAt: null, deletedAt: null },
        { id: 'b2', workDayId: 'wd1', type: 'LUNCH', startedAt: new Date(), endedAt: null, deletedAt: null },
      ];
      expect(() => resolveWorkSessionState(entries as any, breaks as any)).toThrow(AppError);
    });
  });

  describe('Session Status & Actions', () => {
    it('should compute availableActions correctly for NOT_STARTED, WORKING, ON_LUNCH_BREAK, and ENDED', async () => {
      // NOT_STARTED
      vi.mocked(prisma.workDay.findUnique).mockResolvedValueOnce(null as any);
      vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValueOnce({
        snackBreakMinutes: 15,
        lunchBreakMinutes: 60,
      } as any);

      let status = await workSessionService.getSessionStatus(userId);
      expect(status.session.state).toBe('NOT_STARTED');
      expect(status.session.availableActions.start).toBe(true);
      expect(status.session.availableActions.resume).toBe(false);
      expect(status.session.availableActions.finish).toBe(false);

      // ON_LUNCH_BREAK
      const lunchWorkDay = {
        id: 'wd-lunch',
        userId,
        date: new Date(),
        timeEntries: [
          { id: 'te-1', type: 'CLOCK_IN', timestamp: new Date(), deletedAt: null },
          { id: 'te-2', type: 'CLOCK_OUT', timestamp: new Date(), deletedAt: null },
        ],
        workBreaks: [
          { id: 'wb-1', type: 'LUNCH', startedAt: new Date(), endedAt: null, deletedAt: null },
        ],
      };
      vi.mocked(prisma.workDay.findUnique).mockResolvedValueOnce(lunchWorkDay as any);
      vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValueOnce({
        snackBreakMinutes: 0,
        lunchBreakMinutes: 0,
      } as any);

      status = await workSessionService.getSessionStatus(userId);
      expect(status.session.state).toBe('ON_LUNCH_BREAK');
      expect(status.session.availableActions.resume).toBe(true);
      expect(status.session.availableActions.start).toBe(false);
      expect(status.session.availableActions.finish).toBe(true);

      // ENDED
      const endedWorkDay = {
        id: 'wd-ended',
        userId,
        date: new Date(),
        timeEntries: [
          { id: 'te-1', type: 'CLOCK_IN', timestamp: new Date(), deletedAt: null },
          { id: 'te-2', type: 'CLOCK_OUT', timestamp: new Date(), deletedAt: null },
        ],
        workBreaks: [],
      };
      vi.mocked(prisma.workDay.findUnique).mockResolvedValueOnce(endedWorkDay as any);
      vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValueOnce({
        snackBreakMinutes: 15,
        lunchBreakMinutes: 60,
      } as any);

      status = await workSessionService.getSessionStatus(userId);
      expect(status.session.state).toBe('ENDED');
      expect(status.session.availableActions.start).toBe(true); // Allows "Iniciar novo período"!
      expect(status.session.availableActions.resume).toBe(false);
      expect(status.session.availableActions.finish).toBe(false);
    });

    it('should handle resumeSession by closing active break and creating new CLOCK_IN', async () => {
      const activeLunchWorkDay = {
        id: 'wd-lunch',
        userId,
        date: new Date(),
        timeEntries: [
          { id: 'te-1', type: 'CLOCK_IN', timestamp: new Date(), deletedAt: null },
          { id: 'te-2', type: 'CLOCK_OUT', timestamp: new Date(), deletedAt: null },
        ],
        workBreaks: [
          { id: 'wb-1', type: 'LUNCH', startedAt: new Date(), endedAt: null, deletedAt: null },
        ],
      };

      vi.mocked(prisma.workDay.findUnique).mockResolvedValue(activeLunchWorkDay as any);
      vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
        snackBreakMinutes: 0,
        lunchBreakMinutes: 0,
      } as any);

      await workSessionService.resumeSession(userId);

      expect(prisma.workBreak.update).toHaveBeenCalledWith({
        where: { id: 'wb-1' },
        data: { endedAt: expect.any(Date) },
      });
      expect(prisma.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workDayId: 'wd-lunch',
          type: 'CLOCK_IN',
        }),
      });
    });

    it('should handle finishing directly during an active break by closing break without adding extra CLOCK_OUT', async () => {
      const activeLunchWorkDay = {
        id: 'wd-lunch',
        userId,
        date: new Date(),
        timeEntries: [
          { id: 'te-1', type: 'CLOCK_IN', timestamp: new Date(), deletedAt: null },
          { id: 'te-2', type: 'CLOCK_OUT', timestamp: new Date(), deletedAt: null },
        ],
        workBreaks: [
          { id: 'wb-1', type: 'LUNCH', startedAt: new Date(), endedAt: null, deletedAt: null },
        ],
      };

      vi.mocked(prisma.workDay.findUnique).mockResolvedValue(activeLunchWorkDay as any);
      vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
        snackBreakMinutes: 15,
        lunchBreakMinutes: 60,
      } as any);

      await workSessionService.finishSession(userId);

      // Verify workBreak was updated with endedAt
      expect(prisma.workBreak.update).toHaveBeenCalledWith({
        where: { id: 'wb-1' },
        data: { endedAt: expect.any(Date) },
      });
      // Verify NO new timeEntry was created during break finish
      expect(prisma.timeEntry.create).not.toHaveBeenCalled();
    });

    it('should reject invalid state actions with AppError 409', async () => {
      vi.mocked(prisma.workDay.findUnique).mockResolvedValue(null as any);

      // Pause when NOT_STARTED -> 409
      await expect(workSessionService.pauseSession(userId, 'LUNCH')).rejects.toThrow(AppError);

      // Resume when NOT_STARTED -> 409
      await expect(workSessionService.resumeSession(userId)).rejects.toThrow(AppError);
    });

    it('should create new WorkDay on Monday with expectedMinutesSnapshot = 480 when schedule is legacy', async () => {
      vi.mocked(prisma.workDay.findUnique).mockResolvedValueOnce(null as any);
      vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValueOnce({
        id: 'legacy-mon-sched',
        userId,
        weekday: 'MONDAY',
        expectedMinutes: 480,
        plannedStartMinutes: null,
        plannedEndMinutes: null,
        snackBreakMinutes: 15,
        lunchBreakMinutes: 60,
        effectiveFrom: new Date('2000-01-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.workDay.create).mockResolvedValueOnce({
        id: 'wd-new-mon',
        userId,
        date: new Date(),
        expectedMinutesSnapshot: 480,
        timeEntries: [],
        workBreaks: [],
      } as any);

      await workSessionService.startSession(userId);

      expect(prisma.workDay.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            expectedMinutesSnapshot: 480,
          }),
        })
      );
      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workDayId: 'wd-new-mon',
            type: 'CLOCK_IN',
          }),
        })
      );
    });

    it('should create new WorkDay on Sunday with expectedMinutesSnapshot = 0', async () => {
      vi.mocked(prisma.workDay.findUnique).mockResolvedValueOnce(null as any);
      vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValueOnce({
        id: 'sun-sched',
        userId,
        weekday: 'SUNDAY',
        expectedMinutes: 0,
        plannedStartMinutes: null,
        plannedEndMinutes: null,
        snackBreakMinutes: 0,
        lunchBreakMinutes: 0,
        effectiveFrom: new Date('2000-01-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.workDay.create).mockResolvedValueOnce({
        id: 'wd-new-sun',
        userId,
        date: new Date(),
        expectedMinutesSnapshot: 0,
        timeEntries: [],
        workBreaks: [],
      } as any);

      await workSessionService.startSession(userId);

      expect(prisma.workDay.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            expectedMinutesSnapshot: 0,
          }),
        })
      );
    });
  });
});


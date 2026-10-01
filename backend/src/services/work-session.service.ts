import { TimeEntry, WorkBreak, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  getTodayDateStr,
  getTodayUtcMidnight,
  parseDateToUtcMidnight,
  getWeekdayFromCivilDate,
  getLocalDateString,
} from '../utils/date';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayService } from './work-day.service';
import { AppError } from '../errors/app-error';
import { env } from '../config/env';

export type WorkSessionState =
  | 'NOT_STARTED'
  | 'WORKING'
  | 'ON_SNACK_BREAK'
  | 'ON_LUNCH_BREAK'
  | 'ENDED';

export interface ActiveBreakDTO {
  id: string;
  type: 'SNACK' | 'LUNCH';
  startedAt: string;
  elapsedMinutes: number;
  plannedDurationMinutes?: number | null;
  autoResumeAt?: string | null;
  resumedAutomatically?: boolean;
}

export interface AvailableActionsDTO {
  start: boolean;
  pauseSnack: boolean;
  pauseLunch: boolean;
  resume: boolean;
  finish: boolean;
}

export interface WorkSessionStatusDTO {
  state: WorkSessionState;
  reconciliationRequired: boolean;
  activeBreak: ActiveBreakDTO | null;
  availableActions: AvailableActionsDTO;
}

export interface BreakSummaryDTO {
  snackMinutes: number;
  lunchMinutes: number;
  plannedSnackMinutes: number;
  plannedLunchMinutes: number;
}

export function resolveWorkSessionState(
  timeEntries: TimeEntry[],
  workBreaks: WorkBreak[]
): {
  state: WorkSessionState;
  activeBreak: WorkBreak | null;
} {
  const activeEntries = timeEntries.filter((e) => e.deletedAt === null);
  const activeBreaks = workBreaks.filter((b) => b.deletedAt === null);
  const openBreaks = activeBreaks.filter((b) => b.endedAt === null);

  // Inconsistency check: More than 1 open break, or open break with no entries, or open break with last entry CLOCK_IN
  if (openBreaks.length > 1) {
    throw new AppError(
      'Não foi possível sincronizar o estado do expediente.',
      409,
      'WORK_SESSION_INCONSISTENT'
    );
  }

  const openBreak = openBreaks[0] || null;

  if (activeEntries.length === 0) {
    if (openBreak) {
      throw new AppError(
        'Não foi possível sincronizar o estado do expediente.',
        409,
        'WORK_SESSION_INCONSISTENT'
      );
    }
    return { state: 'NOT_STARTED', activeBreak: null };
  }

  const lastEntry = activeEntries[activeEntries.length - 1];

  if (openBreak) {
    if (lastEntry.type !== 'CLOCK_OUT') {
      throw new AppError(
        'Não foi possível sincronizar o estado do expediente.',
        409,
        'WORK_SESSION_INCONSISTENT'
      );
    }
    const state: WorkSessionState =
      openBreak.type === 'SNACK' ? 'ON_SNACK_BREAK' : 'ON_LUNCH_BREAK';
    return { state, activeBreak: openBreak };
  }

  if (lastEntry.type === 'CLOCK_IN') {
    return { state: 'WORKING', activeBreak: null };
  }

  return { state: 'ENDED', activeBreak: null };
}

export class WorkSessionService {
  async getSessionStatus(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<{
    session: WorkSessionStatusDTO;
    breakSummary: BreakSummaryDTO;
  }> {
    const todayStr = getTodayDateStr();
    const todayDate = parseDateToUtcMidnight(todayStr);
    const now = new Date();

    const workDay = await db.workDay.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate,
        },
      },
      include: {
        timeEntries: {
          where: { deletedAt: null },
          orderBy: { timestamp: 'asc' },
        },
        workBreaks: {
          where: { deletedAt: null },
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    const weekday = getWeekdayFromCivilDate(todayStr);
    const schedule = await workScheduleRepository.findEffectiveByUserWeekdayAndDate(
      userId,
      weekday,
      todayDate,
      db
    );

    const plannedSnackMinutes = schedule?.snackBreakMinutes ?? 0;
    const plannedLunchMinutes = schedule?.lunchBreakMinutes ?? 0;

    if (!workDay || workDay.timeEntries.length === 0) {
      return {
        session: {
          state: 'NOT_STARTED',
          reconciliationRequired: false,
          activeBreak: null,
          availableActions: {
            start: true,
            pauseSnack: false,
            pauseLunch: false,
            resume: false,
            finish: false,
          },
        },
        breakSummary: {
          snackMinutes: 0,
          lunchMinutes: 0,
          plannedSnackMinutes,
          plannedLunchMinutes,
        },
      };
    }

    const { state, activeBreak } = resolveWorkSessionState(
      workDay.timeEntries,
      workDay.workBreaks
    );

    let snackMinutes = 0;
    let lunchMinutes = 0;

    for (const b of workDay.workBreaks) {
      const start = new Date(b.startedAt).getTime();
      const end = b.endedAt ? new Date(b.endedAt).getTime() : now.getTime();
      const diffMins = Math.max(0, Math.floor((end - start) / 60000));

      if (b.type === 'SNACK') {
        snackMinutes += diffMins;
      } else if (b.type === 'LUNCH') {
        lunchMinutes += diffMins;
      }
    }

    let activeBreakDTO: ActiveBreakDTO | null = null;
    let reconciliationRequired = false;

    if (activeBreak) {
      const startMs = new Date(activeBreak.startedAt).getTime();
      const elapsed = Math.max(0, Math.floor((now.getTime() - startMs) / 60000));
      const autoResumeAtDate = (activeBreak as any).autoResumeAt
        ? new Date((activeBreak as any).autoResumeAt)
        : null;

      if (
        state === 'ON_LUNCH_BREAK' &&
        activeBreak.type === 'LUNCH' &&
        autoResumeAtDate !== null &&
        autoResumeAtDate.getTime() <= now.getTime()
      ) {
        reconciliationRequired = true;
      }

      activeBreakDTO = {
        id: activeBreak.id,
        type: activeBreak.type as 'SNACK' | 'LUNCH',
        startedAt: activeBreak.startedAt.toISOString(),
        elapsedMinutes: elapsed,
        plannedDurationMinutes: (activeBreak as any).plannedDurationMinutes ?? null,
        autoResumeAt: autoResumeAtDate ? autoResumeAtDate.toISOString() : null,
        resumedAutomatically: (activeBreak as any).resumedAutomatically ?? false,
      };
    }

    const isWorking = state === 'WORKING';
    const isOnBreak = state === 'ON_SNACK_BREAK' || state === 'ON_LUNCH_BREAK';
    const canStart = state === 'NOT_STARTED' || state === 'ENDED';

    const availableActions: AvailableActionsDTO = {
      start: canStart,
      pauseSnack: isWorking,
      pauseLunch: isWorking,
      resume: isOnBreak,
      finish: isWorking || isOnBreak,
    };

    return {
      session: {
        state,
        reconciliationRequired,
        activeBreak: activeBreakDTO,
        availableActions,
      },
      breakSummary: {
        snackMinutes,
        lunchMinutes,
        plannedSnackMinutes,
        plannedLunchMinutes,
      },
    };
  }

  async getTodayWithSession(userId: string): Promise<any> {
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    const summary = await workDayService.getWorkDaySummaryByDateStr(userId, todayStr);
    const { session, breakSummary } = await this.getSessionStatus(userId);

    return {
      ...summary,
      session,
      breakSummary,
    };
  }

  async startSession(userId: string): Promise<any> {
    const todayStr = getTodayDateStr();
    const todayDate = parseDateToUtcMidnight(todayStr);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      let workDay = await tx.workDay.findUnique({
        where: { userId_date: { userId, date: todayDate } },
        include: {
          timeEntries: { where: { deletedAt: null }, orderBy: { timestamp: 'asc' } },
          workBreaks: { where: { deletedAt: null } },
        },
      });

      if (!workDay) {
        const weekday = getWeekdayFromCivilDate(todayStr);
        const schedule = await workScheduleRepository.findEffectiveByUserWeekdayAndDate(
          userId,
          weekday,
          todayDate,
          tx
        );
        const expectedSnapshot = schedule ? schedule.expectedMinutes : 0;

        workDay = await tx.workDay.create({
          data: {
            userId,
            date: todayDate,
            expectedMinutesSnapshot: expectedSnapshot,
          },
          include: {
            timeEntries: { where: { deletedAt: null }, orderBy: { timestamp: 'asc' } },
            workBreaks: { where: { deletedAt: null } },
          },
        });
      }

      const { state } = resolveWorkSessionState(workDay.timeEntries, workDay.workBreaks);
      if (state === 'WORKING') {
        throw new AppError(
          'Expediente já está em andamento.',
          409,
          'WORK_SESSION_ALREADY_ACTIVE'
        );
      }
      if (state === 'ON_SNACK_BREAK' || state === 'ON_LUNCH_BREAK') {
        throw new AppError(
          'Existe uma pausa ativa em andamento.',
          409,
          'BREAK_ALREADY_ACTIVE'
        );
      }

      await tx.timeEntry.create({
        data: {
          workDayId: workDay.id,
          type: 'CLOCK_IN',
          timestamp: now,
          source: 'CLOCK',
        },
      });
    });

    return this.getTodayWithSession(userId);
  }

  async pauseSession(userId: string, breakType: 'SNACK' | 'LUNCH'): Promise<any> {
    const todayStr = getTodayDateStr();
    const todayDate = parseDateToUtcMidnight(todayStr);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const workDay = await tx.workDay.findUnique({
        where: { userId_date: { userId, date: todayDate } },
        include: {
          timeEntries: { where: { deletedAt: null }, orderBy: { timestamp: 'asc' } },
          workBreaks: { where: { deletedAt: null } },
        },
      });

      if (!workDay || workDay.timeEntries.length === 0) {
        throw new AppError(
          'Nenhum expediente em andamento para iniciar pausa.',
          409,
          'WORK_SESSION_NOT_ACTIVE'
        );
      }

      const { state } = resolveWorkSessionState(workDay.timeEntries, workDay.workBreaks);
      if (state !== 'WORKING') {
        throw new AppError(
          'Não é possível pausar pois o expediente não está trabalhando.',
          409,
          'WORK_SESSION_NOT_WORKING'
        );
      }

      let plannedDurationMinutes: number | null = null;
      let autoResumeAt: Date | null = null;

      if (breakType === 'LUNCH') {
        const weekday = getWeekdayFromCivilDate(todayStr);
        const schedule = await workScheduleRepository.findEffectiveByUserWeekdayAndDate(
          userId,
          weekday,
          todayDate,
          tx
        );
        const lunchMins = schedule?.lunchBreakMinutes ?? 60;
        if (lunchMins > 0) {
          plannedDurationMinutes = lunchMins;
          autoResumeAt = new Date(now.getTime() + lunchMins * 60 * 1000);
        }
      }

      // 1. Create CLOCK_OUT time entry
      await tx.timeEntry.create({
        data: {
          workDayId: workDay.id,
          type: 'CLOCK_OUT',
          timestamp: now,
          source: 'CLOCK',
        },
      });

      // 2. Create active WorkBreak
      await tx.workBreak.create({
        data: {
          workDayId: workDay.id,
          type: breakType,
          startedAt: now,
          endedAt: null,
          plannedDurationMinutes,
          autoResumeAt,
          resumedAutomatically: false,
        },
      });
    });

    return this.getTodayWithSession(userId);
  }

  async resumeSession(userId: string): Promise<any> {
    const todayDate = getTodayUtcMidnight();
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const workDay = await tx.workDay.findUnique({
        where: { userId_date: { userId, date: todayDate } },
        include: {
          timeEntries: { where: { deletedAt: null }, orderBy: { timestamp: 'asc' } },
          workBreaks: { where: { deletedAt: null } },
        },
      });

      if (!workDay) {
        throw new AppError('Nenhuma pausa ativa para retomar.', 409, 'NO_ACTIVE_BREAK');
      }

      const { state, activeBreak } = resolveWorkSessionState(
        workDay.timeEntries,
        workDay.workBreaks
      );
      if (!activeBreak || (state !== 'ON_SNACK_BREAK' && state !== 'ON_LUNCH_BREAK')) {
        throw new AppError('Nenhuma pausa ativa para retomar.', 409, 'NO_ACTIVE_BREAK');
      }

      // 1. Close active break
      await tx.workBreak.update({
        where: { id: activeBreak.id },
        data: {
          endedAt: now,
          resumedAutomatically: false,
        },
      });

      // 2. Create CLOCK_IN time entry
      await tx.timeEntry.create({
        data: {
          workDayId: workDay.id,
          type: 'CLOCK_IN',
          timestamp: now,
          source: 'CLOCK',
        },
      });
    });

    return this.getTodayWithSession(userId);
  }

  async finishSession(userId: string): Promise<any> {
    const todayDate = getTodayUtcMidnight();
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const workDay = await tx.workDay.findUnique({
        where: { userId_date: { userId, date: todayDate } },
        include: {
          timeEntries: { where: { deletedAt: null }, orderBy: { timestamp: 'asc' } },
          workBreaks: { where: { deletedAt: null } },
        },
      });

      if (!workDay || workDay.timeEntries.length === 0) {
        throw new AppError('Nenhum expediente ativo para encerrar.', 409, 'NO_ACTIVE_SESSION');
      }

      const { state, activeBreak } = resolveWorkSessionState(
        workDay.timeEntries,
        workDay.workBreaks
      );

      if (activeBreak) {
        // Finishing while on break: Close active break, do NOT add new entries.
        await tx.workBreak.update({
          where: { id: activeBreak.id },
          data: {
            endedAt: now,
            resumedAutomatically: false,
          },
        });
      } else if (state === 'WORKING') {
        // Finishing while working: Create CLOCK_OUT entry.
        await tx.timeEntry.create({
          data: {
            workDayId: workDay.id,
            type: 'CLOCK_OUT',
            timestamp: now,
            source: 'CLOCK',
          },
        });
      } else {
        throw new AppError('O expediente já está encerrado.', 409, 'SESSION_ALREADY_ENDED');
      }
    });

    return this.getTodayWithSession(userId);
  }

  async reconcileSession(userId: string): Promise<any> {
    const todayDate = getTodayUtcMidnight();
    const now = new Date();

    try {
      await prisma.$transaction(
        async (tx) => {
          // Re-query WorkDay with active TimeEntries and WorkBreaks inside transaction
          const workDay = await tx.workDay.findUnique({
            where: { userId_date: { userId, date: todayDate } },
            include: {
              timeEntries: {
                where: { deletedAt: null },
                orderBy: { timestamp: 'asc' },
              },
              workBreaks: {
                where: { deletedAt: null },
                orderBy: { startedAt: 'asc' },
              },
            },
          });

          if (!workDay) {
            // No workday exists for today: nothing to reconcile
            return;
          }

          const activeBreaks = workDay.workBreaks.filter(
            (b) => b.deletedAt === null && b.endedAt === null
          );

          // If multiple open breaks exist, data is inconsistent
          if (activeBreaks.length > 1) {
            throw new AppError(
              'Não foi possível sincronizar o estado do expediente.',
              409,
              'WORK_SESSION_INCONSISTENT'
            );
          }

          const openBreak = activeBreaks[0];

          // If no open break, or break is not LUNCH, or no autoResumeAt: nothing to reconcile (idempotent)
          if (!openBreak || openBreak.type !== 'LUNCH' || !openBreak.autoResumeAt) {
            return;
          }

          const autoResumeTime = new Date(openBreak.autoResumeAt).getTime();
          if (autoResumeTime > now.getTime()) {
            // Lunch break has not expired yet: idempotent return
            return;
          }

          // At this point, we have an active expired LUNCH break.
          // Validate active time entries:
          const activeEntries = workDay.timeEntries.filter((e) => e.deletedAt === null);
          if (activeEntries.length === 0) {
            throw new AppError(
              'Não foi possível sincronizar o estado do expediente.',
              409,
              'WORK_SESSION_INCONSISTENT'
            );
          }

          const lastEntry = activeEntries[activeEntries.length - 1];
          // Last entry MUST be CLOCK_OUT. If last entry is CLOCK_IN or incompatible:
          if (lastEntry.type !== 'CLOCK_OUT') {
            throw new AppError(
              'Não foi possível sincronizar o estado do expediente.',
              409,
              'WORK_SESSION_INCONSISTENT'
            );
          }

          // Incompatibility check: if last entry timestamp is after autoResumeAt
          if (new Date(lastEntry.timestamp).getTime() > autoResumeTime) {
            throw new AppError(
              'Não foi possível sincronizar o estado do expediente.',
              409,
              'WORK_SESSION_INCONSISTENT'
            );
          }

          // 1. Close active break at exact autoResumeAt
          await tx.workBreak.update({
            where: { id: openBreak.id },
            data: {
              endedAt: openBreak.autoResumeAt,
              resumedAutomatically: true,
            },
          });

          // 2. Create CLOCK_IN at exact autoResumeAt
          await tx.timeEntry.create({
            data: {
              workDayId: workDay.id,
              type: 'CLOCK_IN',
              timestamp: openBreak.autoResumeAt,
              source: 'CLOCK',
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2034'
      ) {
        // Concurrency conflict handled cleanly (the concurrent transaction already committed or is committing)
      } else {
        throw error;
      }
    }

    return this.getTodayWithSession(userId);
  }
}

export const workSessionService = new WorkSessionService();

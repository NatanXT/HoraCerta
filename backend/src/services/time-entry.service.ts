import { TimeEntryType, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository } from '../repositories/work-day.repository';
import { timeEntryRepository } from '../repositories/time-entry.repository';
import { getLocalDateString, parseDateToUtcMidnight, getWeekdayFromCivilDate } from '../utils/date';
import { workDayService, WorkDaySummaryDto } from './work-day.service';

export class TimeEntryService {
  async clockIn(userId: string): Promise<WorkDaySummaryDto> {
    const now = new Date();
    const todayStr = getLocalDateString(now, env.APP_TIMEZONE);
    const dateUtcMidnight = parseDateToUtcMidnight(todayStr);
    const weekday = getWeekdayFromCivilDate(todayStr);

    const schedule = await workScheduleRepository.findEffectiveByUserWeekdayAndDate(
      userId,
      weekday,
      dateUtcMidnight
    );
    const expectedMinutesSnapshot = schedule ? schedule.expectedMinutes : 0;

    try {
      await prisma.$transaction(
        async (tx) => {
          const workDay = await workDayRepository.findOrCreateByUserAndDate(
            userId,
            dateUtcMidnight,
            expectedMinutesSnapshot,
            tx
          );

          const entries = workDay.timeEntries;
          if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1];
            if (lastEntry.type === TimeEntryType.CLOCK_IN) {
              throw new AppError(
                'Não é possível registrar uma entrada porque já existe uma entrada em aberto.',
                409,
                'INVALID_CLOCK_STATE'
              );
            }
          }

          await timeEntryRepository.create(workDay.id, TimeEntryType.CLOCK_IN, now, tx);
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
        throw new AppError(
          'Concorrência detectada ao registrar ponto. Por favor, tente novamente.',
          409,
          'CONCURRENCY_CONFLICT'
        );
      }
      throw error;
    }

    return workDayService.getWorkDaySummaryByDateStr(userId, todayStr);
  }

  async clockOut(userId: string): Promise<WorkDaySummaryDto> {
    const now = new Date();
    const todayStr = getLocalDateString(now, env.APP_TIMEZONE);
    const dateUtcMidnight = parseDateToUtcMidnight(todayStr);

    try {
      await prisma.$transaction(
        async (tx) => {
          const workDay = await workDayRepository.findByUserAndDate(
            userId,
            dateUtcMidnight,
            tx
          );

          if (!workDay || workDay.timeEntries.length === 0) {
            throw new AppError(
              'Não é possível registrar uma saída porque não há entrada em aberto.',
              409,
              'INVALID_CLOCK_STATE'
            );
          }

          const lastEntry = workDay.timeEntries[workDay.timeEntries.length - 1];
          if (lastEntry.type === TimeEntryType.CLOCK_OUT) {
            throw new AppError(
              'Não é possível registrar uma saída porque não há entrada em aberto.',
              409,
              'INVALID_CLOCK_STATE'
            );
          }

          await timeEntryRepository.create(workDay.id, TimeEntryType.CLOCK_OUT, now, tx);
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
        throw new AppError(
          'Concorrência detectada ao registrar ponto. Por favor, tente novamente.',
          409,
          'CONCURRENCY_CONFLICT'
        );
      }
      throw error;
    }

    return workDayService.getWorkDaySummaryByDateStr(userId, todayStr);
  }
}

export const timeEntryService = new TimeEntryService();

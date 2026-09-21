import { TimeEntryType, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { userRepository } from '../repositories/user.repository';
import { workDayRepository } from '../repositories/work-day.repository';
import { timeEntryRepository } from '../repositories/time-entry.repository';
import { getLocalDateString, parseDateToUtcMidnight } from '../utils/date';
import { workDayService, WorkDaySummaryDto } from './work-day.service';

export class TimeEntryService {
  async clockIn(): Promise<WorkDaySummaryDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const now = new Date();
    const todayStr = getLocalDateString(now, env.APP_TIMEZONE);
    const dateUtcMidnight = parseDateToUtcMidnight(todayStr);

    try {
      await prisma.$transaction(
        async (tx) => {
          const workDay = await workDayRepository.findOrCreateByUserAndDate(
            user.id,
            dateUtcMidnight,
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

    return workDayService.getWorkDaySummaryByDateStr(todayStr);
  }

  async clockOut(): Promise<WorkDaySummaryDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const now = new Date();
    const todayStr = getLocalDateString(now, env.APP_TIMEZONE);
    const dateUtcMidnight = parseDateToUtcMidnight(todayStr);

    try {
      await prisma.$transaction(
        async (tx) => {
          const workDay = await workDayRepository.findByUserAndDate(
            user.id,
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

    return workDayService.getWorkDaySummaryByDateStr(todayStr);
  }
}

export const timeEntryService = new TimeEntryService();

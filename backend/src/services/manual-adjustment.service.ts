import { TimeEntryType, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository } from '../repositories/work-day.repository';
import { timeEntryRepository } from '../repositories/time-entry.repository';
import { workDayAdjustmentRepository } from '../repositories/work-day-adjustment.repository';
import {
  getLocalDateString,
  parseDateToUtcMidnight,
  getWeekdayFromDate,
  parseDateTimeInTimezone,
} from '../utils/date';
import { workDayService, WorkDaySummaryDto } from './work-day.service';
import { ManualAdjustmentInput } from '../schemas/manual-adjustment.schema';

export interface WorkDayAdjustmentSnapshotEntryDto {
  type: TimeEntryType;
  timestamp: string;
  source: string;
}

export interface WorkDayAdjustmentDto {
  id: string;
  workDayId: string;
  reason: string;
  beforeEntries: WorkDayAdjustmentSnapshotEntryDto[];
  afterEntries: WorkDayAdjustmentSnapshotEntryDto[];
  createdAt: Date;
}

export interface SaveManualAdjustmentResponseDto {
  summary: WorkDaySummaryDto;
  adjustment: WorkDayAdjustmentDto;
}

export interface GetAdjustmentsResponseDto {
  date: string;
  adjustments: WorkDayAdjustmentDto[];
}

export function parseAdjustmentSnapshot(
  value: Prisma.JsonValue
): WorkDayAdjustmentSnapshotEntryDto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: WorkDayAdjustmentSnapshotEntryDto[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      (item.type === TimeEntryType.CLOCK_IN || item.type === TimeEntryType.CLOCK_OUT) &&
      typeof item.timestamp === 'string' &&
      typeof item.source === 'string'
    ) {
      entries.push({
        type: item.type as TimeEntryType,
        timestamp: item.timestamp,
        source: item.source,
      });
    }
  }

  return entries;
}

export class ManualAdjustmentService {
  async saveAdjustment(
    dateStr: string,
    payload: ManualAdjustmentInput
  ): Promise<SaveManualAdjustmentResponseDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);

    if (dateStr === todayStr) {
      throw new AppError(
        'O dia atual deve ser registrado pelo fluxo normal de ponto.',
        409,
        'MANUAL_ADJUSTMENT_NOT_ALLOWED'
      );
    }

    if (dateStr > todayStr) {
      throw new AppError(
        'Não é possível ajustar manualmente uma data futura.',
        409,
        'MANUAL_ADJUSTMENT_NOT_ALLOWED'
      );
    }

    const dateUtcMidnight = parseDateToUtcMidnight(dateStr);
    const weekday = getWeekdayFromDate(dateStr, env.APP_TIMEZONE);

    let savedAdjustmentDto: WorkDayAdjustmentDto | null = null;

    try {
      await prisma.$transaction(
        async (tx) => {
          const schedule = await workScheduleRepository.findEffectiveByUserWeekdayAndDate(
            user.id,
            weekday,
            dateUtcMidnight,
            tx
          );
          const defaultExpectedMinutes = schedule ? schedule.expectedMinutes : 0;

          const workDay = await workDayRepository.findOrCreateByUserAndDate(
            user.id,
            dateUtcMidnight,
            defaultExpectedMinutes,
            tx
          );

          const activeEntries = await timeEntryRepository.findActiveByWorkDayId(
            workDay.id,
            tx
          );

          const beforeEntries: WorkDayAdjustmentSnapshotEntryDto[] = activeEntries.map(
            (e) => ({
              type: e.type,
              timestamp: e.timestamp.toISOString(),
              source: e.source,
            })
          );

          const now = new Date();
          await timeEntryRepository.softDeleteActiveByWorkDayId(workDay.id, now, tx);

          const sortedIntervals = [...payload.intervals].sort((a, b) =>
            a.clockIn.localeCompare(b.clockIn)
          );

          const newEntriesToCreate: { type: TimeEntryType; timestamp: Date }[] = [];
          for (const interval of sortedIntervals) {
            const clockInUtc = parseDateTimeInTimezone(
              dateStr,
              interval.clockIn,
              env.APP_TIMEZONE
            );
            const clockOutUtc = parseDateTimeInTimezone(
              dateStr,
              interval.clockOut,
              env.APP_TIMEZONE
            );
            newEntriesToCreate.push({
              type: TimeEntryType.CLOCK_IN,
              timestamp: clockInUtc,
            });
            newEntriesToCreate.push({
              type: TimeEntryType.CLOCK_OUT,
              timestamp: clockOutUtc,
            });
          }

          const createdManualEntries = await timeEntryRepository.createManyManual(
            workDay.id,
            newEntriesToCreate,
            tx
          );

          const afterEntries: WorkDayAdjustmentSnapshotEntryDto[] = createdManualEntries.map(
            (e) => ({
              type: e.type,
              timestamp: e.timestamp.toISOString(),
              source: e.source,
            })
          );

          const beforeJson = beforeEntries as unknown as Prisma.InputJsonValue;
          const afterJson = afterEntries as unknown as Prisma.InputJsonValue;

          const adjustmentRecord = await workDayAdjustmentRepository.create(
            workDay.id,
            payload.reason,
            beforeJson,
            afterJson,
            tx
          );

          savedAdjustmentDto = {
            id: adjustmentRecord.id,
            workDayId: adjustmentRecord.workDayId,
            reason: adjustmentRecord.reason,
            beforeEntries,
            afterEntries,
            createdAt: adjustmentRecord.createdAt,
          };
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
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new AppError(
          'Os registros deste dia foram alterados durante o ajuste. Atualize os dados e tente novamente.',
          409,
          'CONCURRENCY_CONFLICT'
        );
      }

      throw error;
    }

    const summary = await workDayService.getWorkDaySummaryByDateStr(dateStr);

    return {
      summary,
      adjustment: savedAdjustmentDto!,
    };
  }

  async getAdjustments(dateStr: string): Promise<GetAdjustmentsResponseDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const dateUtcMidnight = parseDateToUtcMidnight(dateStr);
    const workDay = await workDayRepository.findByUserAndDate(user.id, dateUtcMidnight);

    if (!workDay) {
      return {
        date: dateStr,
        adjustments: [],
      };
    }

    const adjustments = await workDayAdjustmentRepository.findByWorkDayId(workDay.id);

    return {
      date: dateStr,
      adjustments: adjustments.map((adj) => ({
        id: adj.id,
        workDayId: adj.workDayId,
        reason: adj.reason,
        beforeEntries: parseAdjustmentSnapshot(adj.beforeEntries),
        afterEntries: parseAdjustmentSnapshot(adj.afterEntries),
        createdAt: adj.createdAt,
      })),
    };
  }
}

export const manualAdjustmentService = new ManualAdjustmentService();

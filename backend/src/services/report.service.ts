import { TimeEntryType, TimeEntrySource, CalendarOccurrenceType } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { bankHoursConfigRepository } from '../repositories/bank-hours-config.repository';
import {
  getLocalDateString,
  parseDateToUtcMidnight,
  getWeekdayFromDate,
} from '../utils/date';
import { resolveWorkDayState, WorkDayStatus } from '../utils/work-day-status';
import { WorkScheduleResolver } from '../utils/work-schedule-resolver';
import { CalendarOccurrenceResolver } from '../utils/calendar-occurrence-resolver';
import {
  CalendarOccurrenceDTO,
  formatCalendarOccurrenceDTO,
} from '../types/calendar-occurrence.dto';

export interface ReportDayEntryDto {
  id: string;
  type: TimeEntryType;
  timestamp: Date;
  source: TimeEntrySource;
}

export interface ReportDayDto {
  date: string;
  weekday: string;
  status: WorkDayStatus;
  baseExpectedMinutes: number;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number | null;
  isBankAccounted: boolean;
  isProvisional: boolean;
  occurrence: CalendarOccurrenceDTO | null;
  entrySource: 'CLOCK' | 'MANUAL' | 'MIXED' | null;
  entries: ReportDayEntryDto[];
}

export interface ReportSummaryDto {
  calendarDays: number;
  scheduledMinutes: number;
  workedMinutes: number;
  recordedDays: number;
  excusedDays: number;
  restDays: number;
  noRecordsDays: number;
  incompleteDays: number;
  inProgressDays: number;
  futureDays: number;
  pendingDays: number;
}

export interface ReportBankHoursDto {
  configured: boolean;
  startDate: string | null;
  periodCreditMinutes: number | null;
  periodDebitMinutes: number | null;
  periodConsolidatedBalanceMinutes: number | null;
  accountedDays: number;
  provisionalTodayBalanceMinutes: number | null;
  livePeriodBalanceMinutes: number | null;
}

export interface ReportOccurrenceTypeSummaryDto {
  type: CalendarOccurrenceType | string;
  days: number;
}

export interface ReportOccurrenceSummaryDto {
  totalOccurrenceDays: number;
  byType: ReportOccurrenceTypeSummaryDto[];
}

export interface WorkHoursReportDto {
  period: {
    from: string;
    to: string;
    generatedAt: string;
    timezone: string;
    hasProvisionalData: boolean;
  };
  summary: ReportSummaryDto;
  bankHours: ReportBankHoursDto;
  occurrences: ReportOccurrenceSummaryDto;
  days: ReportDayDto[];
}

export class ReportService {
  async getWorkHoursReport(fromStr: string, toStr: string): Promise<WorkHoursReportDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const fromUtc = parseDateToUtcMidnight(fromStr);
    const toUtc = parseDateToUtcMidnight(toStr);
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);

    // Single batch queries
    const workDays = await workDayRepository.findByUserAndDateRange(user.id, fromUtc, toUtc);
    const schedules = await workScheduleRepository.findAllVersionsByUserUntilDate(user.id, toUtc);
    const occurrences = await calendarOccurrenceRepository.findActiveInRange(user.id, fromUtc, toUtc);
    const bankConfig = await bankHoursConfigRepository.findByUserId(user.id);

    const scheduleResolver = new WorkScheduleResolver(schedules);
    const occurrenceResolver = new CalendarOccurrenceResolver(occurrences);

    const workDayMap = new Map<string, WorkDayWithEntries>();
    for (const wd of workDays) {
      const dateStr = wd.date.toISOString().substring(0, 10);
      workDayMap.set(dateStr, wd);
    }

    // Occurrence Breakdown Intersections within [fromStr, toStr]
    const occurrenceDaysByTypeMap = new Map<string, number>();
    let totalOccurrenceDays = 0;

    for (const occ of occurrences) {
      const occStartStr = occ.startDate.toISOString().substring(0, 10);
      const occEndStr = occ.endDate.toISOString().substring(0, 10);

      // Clamp intersection to report period [fromStr, toStr]
      const startClamp = occStartStr < fromStr ? fromStr : occStartStr;
      const endClamp = occEndStr > toStr ? toStr : occEndStr;

      if (startClamp <= endClamp) {
        const startMs = parseDateToUtcMidnight(startClamp).getTime();
        const endMs = parseDateToUtcMidnight(endClamp).getTime();
        const daysInRange = Math.floor((endMs - startMs) / 86400000) + 1;

        totalOccurrenceDays += daysInRange;
        const currentCount = occurrenceDaysByTypeMap.get(occ.type) || 0;
        occurrenceDaysByTypeMap.set(occ.type, currentCount + daysInRange);
      }
    }

    const byType: ReportOccurrenceTypeSummaryDto[] = Array.from(
      occurrenceDaysByTypeMap.entries()
    ).map(([type, days]) => ({ type, days }));

    // Iterate through days
    const reportDays: ReportDayDto[] = [];
    let calendarDays = 0;
    let scheduledMinutes = 0;
    let workedMinutes = 0;

    let recordedDays = 0;
    let excusedDays = 0;
    let restDays = 0;
    let noRecordsDays = 0;
    let incompleteDays = 0;
    let inProgressDays = 0;
    let futureDays = 0;

    let periodCreditMinutes = 0;
    let periodDebitMinutes = 0;
    let accountedDaysCount = 0;
    let provisionalTodayBalanceMinutes: number | null = null;

    const bankStartDateStr = bankConfig
      ? bankConfig.startDate.toISOString().substring(0, 10)
      : null;

    let currentIter = new Date(fromUtc.getTime());
    while (currentIter <= toUtc) {
      calendarDays++;
      const dateStr = currentIter.toISOString().substring(0, 10);
      const weekday = getWeekdayFromDate(dateStr, env.APP_TIMEZONE);
      const dateUtcMidnight = parseDateToUtcMidnight(dateStr);
      const workDay = workDayMap.get(dateStr);
      const occurrence = occurrenceResolver.getForDate(dateStr);

      const defaultExpected = scheduleResolver.getExpectedMinutesForDate(
        weekday,
        dateUtcMidnight
      );
      const baseExpectedMinutes = workDay?.expectedMinutesSnapshot ?? defaultExpected ?? 0;

      const state = resolveWorkDayState({
        dateStr,
        todayStr,
        defaultExpectedMinutes: baseExpectedMinutes,
        workDay,
        occurrence,
      });

      // Active entries (deletedAt === null)
      const activeEntries = workDay
        ? workDay.timeEntries.filter((e) => e.deletedAt === null)
        : [];

      let entrySource: 'CLOCK' | 'MANUAL' | 'MIXED' | null = null;
      if (activeEntries.length > 0) {
        const hasClock = activeEntries.some((e) => e.source === 'CLOCK');
        const hasManual = activeEntries.some((e) => e.source === 'MANUAL');
        if (hasClock && hasManual) {
          entrySource = 'MIXED';
        } else if (hasManual) {
          entrySource = 'MANUAL';
        } else {
          entrySource = 'CLOCK';
        }
      }

      const isToday = dateStr === todayStr;
      const isHistorical = dateStr < todayStr;
      const isBankAccounted =
        bankConfig !== null &&
        bankStartDateStr !== null &&
        dateStr >= bankStartDateStr &&
        isHistorical &&
        state.status === 'RECORDED';

      if (dateStr <= todayStr) {
        scheduledMinutes += state.expectedMinutes;
        workedMinutes += state.totalWorkedMinutes;
      }

      switch (state.status) {
        case 'RECORDED':
          recordedDays++;
          break;
        case 'EXCUSED':
          excusedDays++;
          break;
        case 'REST_DAY':
          restDays++;
          break;
        case 'NO_RECORDS':
          noRecordsDays++;
          break;
        case 'INCOMPLETE':
          incompleteDays++;
          break;
        case 'IN_PROGRESS':
          inProgressDays++;
          break;
        case 'FUTURE':
          futureDays++;
          break;
      }

      if (isBankAccounted && state.balanceMinutes !== null) {
        accountedDaysCount++;
        if (state.balanceMinutes > 0) {
          periodCreditMinutes += state.balanceMinutes;
        } else if (state.balanceMinutes < 0) {
          periodDebitMinutes += Math.abs(state.balanceMinutes);
        }
      }

      if (isToday) {
        if (state.hasEntries) {
          provisionalTodayBalanceMinutes = state.totalWorkedMinutes - state.expectedMinutes;
        } else if (state.expectedMinutes === 0) {
          provisionalTodayBalanceMinutes = 0;
        } else {
          provisionalTodayBalanceMinutes = null;
        }
      }

      reportDays.push({
        date: dateStr,
        weekday,
        status: state.status,
        baseExpectedMinutes,
        expectedMinutes: state.expectedMinutes,
        workedMinutes: state.workedMinutes,
        currentSessionMinutes: state.currentSessionMinutes,
        totalWorkedMinutes: state.totalWorkedMinutes,
        balanceMinutes: state.balanceMinutes,
        isBankAccounted,
        isProvisional: isToday,
        occurrence: formatCalendarOccurrenceDTO(state.occurrence),
        entrySource,
        entries: activeEntries.map((e) => ({
          id: e.id,
          type: e.type,
          timestamp: e.timestamp,
          source: e.source,
        })),
      });

      currentIter.setUTCDate(currentIter.getUTCDate() + 1);
    }

    const pendingDays = noRecordsDays + incompleteDays;

    let periodConsolidatedBalanceMinutes: number | null = null;
    let livePeriodBalanceMinutes: number | null = null;

    if (bankConfig) {
      periodConsolidatedBalanceMinutes = periodCreditMinutes - periodDebitMinutes;
      livePeriodBalanceMinutes =
        periodConsolidatedBalanceMinutes + (provisionalTodayBalanceMinutes ?? 0);
    }

    return {
      period: {
        from: fromStr,
        to: toStr,
        generatedAt: new Date().toISOString(),
        timezone: env.APP_TIMEZONE,
        hasProvisionalData: provisionalTodayBalanceMinutes !== null,
      },
      summary: {
        calendarDays,
        scheduledMinutes,
        workedMinutes,
        recordedDays,
        excusedDays,
        restDays,
        noRecordsDays,
        incompleteDays,
        inProgressDays,
        futureDays,
        pendingDays,
      },
      bankHours: {
        configured: bankConfig !== null,
        startDate: bankStartDateStr,
        periodCreditMinutes: bankConfig ? periodCreditMinutes : null,
        periodDebitMinutes: bankConfig ? periodDebitMinutes : null,
        periodConsolidatedBalanceMinutes,
        accountedDays: accountedDaysCount,
        provisionalTodayBalanceMinutes,
        livePeriodBalanceMinutes,
      },
      occurrences: {
        totalOccurrenceDays,
        byType,
      },
      days: reportDays,
    };
  }
}

export const reportService = new ReportService();

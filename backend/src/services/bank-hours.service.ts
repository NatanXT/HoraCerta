import { env } from '../config/env';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { bankHoursConfigRepository } from '../repositories/bank-hours-config.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import {
  getLocalDateString,
  parseDateToUtcMidnight,
  getWeekdayFromCivilDate,
} from '../utils/date';
import { resolveWorkDayState } from '../utils/work-day-status';
import { WorkScheduleResolver } from '../utils/work-schedule-resolver';
import { CalendarOccurrenceResolver } from '../utils/calendar-occurrence-resolver';

export interface BankHoursConfigDto {
  startDate: string;
  initialBalanceMinutes: number;
}

export interface BankHoursPeriodDto {
  startDate: string;
  endDate: string;
}

export interface BankHoursSummaryDto {
  initialBalanceMinutes: number;
  consolidatedBalanceMinutes: number;
  todayBalanceMinutes: number | null;
  liveBalanceMinutes: number;
  creditMinutes: number;
  debitMinutes: number;
  accountedDays: number;
  pendingDays: number;
}

export interface BankHoursMonthlySummaryDto {
  month: string;
  creditMinutes: number;
  debitMinutes: number;
  netMinutes: number;
  accountedDays: number;
  pendingDays: number;
}

export interface BankHoursPendingDayDto {
  date: string;
  status: 'NO_RECORDS' | 'INCOMPLETE';
  expectedMinutes: number;
  totalWorkedMinutes: number;
}

export interface BankHoursResponseDto {
  configured: boolean;
  suggestedStartDate: string | null;
  config: BankHoursConfigDto | null;
  period: BankHoursPeriodDto | null;
  summary: BankHoursSummaryDto | null;
  monthly: BankHoursMonthlySummaryDto[];
  pending: BankHoursPendingDayDto[];
}

export class BankHoursService {
  async getBankHoursStatus(userId: string): Promise<BankHoursResponseDto> {
    const config = await bankHoursConfigRepository.findByUserId(userId);
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);

    if (!config) {
      const oldestWorkDay = await workDayRepository.findOldestByUser(userId);
      const suggestedStartDate = oldestWorkDay
        ? oldestWorkDay.date.toISOString().substring(0, 10)
        : todayStr;

      return {
        configured: false,
        suggestedStartDate,
        config: null,
        period: null,
        summary: null,
        monthly: [],
        pending: [],
      };
    }

    const startDateStr = config.startDate.toISOString().substring(0, 10);
    const startDateUtc = parseDateToUtcMidnight(startDateStr);
    const endDateUtc = parseDateToUtcMidnight(todayStr);

    const workDays = await workDayRepository.findByUserAndDateRange(userId, startDateUtc, endDateUtc);
    const schedules = await workScheduleRepository.findAllVersionsByUserUntilDate(userId, endDateUtc);
    const scheduleResolver = new WorkScheduleResolver(schedules);

    const occurrences = await calendarOccurrenceRepository.findActiveInRange(
      userId,
      startDateUtc,
      endDateUtc
    );
    const occurrenceResolver = new CalendarOccurrenceResolver(occurrences);

    const workDayMap = new Map<string, WorkDayWithEntries>();
    for (const wd of workDays) {
      const dateStr = wd.date.toISOString().substring(0, 10);
      workDayMap.set(dateStr, wd);
    }

    let creditMinutes = 0;
    let debitMinutes = 0;
    let historicalBalanceSum = 0;
    let accountedDays = 0;
    let pendingDays = 0;

    let todayBalanceMinutes: number | null = null;

    const monthlyMap = new Map<
      string,
      { creditMinutes: number; debitMinutes: number; accountedDays: number; pendingDays: number }
    >();

    const pendingList: BankHoursPendingDayDto[] = [];

    const getMonthlyStats = (monthKey: string) => {
      let stats = monthlyMap.get(monthKey);
      if (!stats) {
        stats = { creditMinutes: 0, debitMinutes: 0, accountedDays: 0, pendingDays: 0 };
        monthlyMap.set(monthKey, stats);
      }
      return stats;
    };

    let currentIter = new Date(`${startDateStr}T00:00:00.000Z`);
    const endIter = new Date(`${todayStr}T00:00:00.000Z`);

    while (currentIter <= endIter) {
      const dateStr = currentIter.toISOString().substring(0, 10);
      const monthKey = dateStr.substring(0, 7);
      const weekday = getWeekdayFromCivilDate(dateStr);
      const dateUtcMidnight = parseDateToUtcMidnight(dateStr);
      const workDay = workDayMap.get(dateStr);
      const occurrence = occurrenceResolver.getForDate(dateStr);

      const defaultExpected = scheduleResolver.getExpectedMinutesForDate(weekday, dateUtcMidnight);
      const state = resolveWorkDayState({
        dateStr,
        todayStr,
        defaultExpectedMinutes: defaultExpected,
        workDay,
        occurrence,
      });

      if (state.status === 'IN_PROGRESS' || dateStr === todayStr) {
        if (state.occurrence?.type === 'BANK_HOURS_LEAVE') {
          todayBalanceMinutes = state.totalWorkedMinutes - defaultExpected;
        } else if (state.hasEntries) {
          todayBalanceMinutes = state.totalWorkedMinutes - state.expectedMinutes;
        } else if (state.expectedMinutes === 0) {
          todayBalanceMinutes = 0;
        } else {
          todayBalanceMinutes = null;
        }
      } else {
        const monthStats = getMonthlyStats(monthKey);

        if (state.status === 'NO_RECORDS') {
          pendingDays++;
          monthStats.pendingDays++;
          pendingList.push({
            date: dateStr,
            status: 'NO_RECORDS',
            expectedMinutes: state.expectedMinutes,
            totalWorkedMinutes: 0,
          });
        } else if (state.status === 'INCOMPLETE') {
          pendingDays++;
          monthStats.pendingDays++;
          pendingList.push({
            date: dateStr,
            status: 'INCOMPLETE',
            expectedMinutes: state.expectedMinutes,
            totalWorkedMinutes: state.workedMinutes,
          });
        } else if (
          state.status === 'RECORDED' ||
          (state.status === 'EXCUSED' && state.occurrence?.type === 'BANK_HOURS_LEAVE')
        ) {
          const dayBalance =
            state.balanceMinutes !== null
              ? state.balanceMinutes
              : state.totalWorkedMinutes - state.expectedMinutes;

          if (dayBalance > 0) {
            creditMinutes += dayBalance;
            monthStats.creditMinutes += dayBalance;
          } else if (dayBalance < 0) {
            const absVal = Math.abs(dayBalance);
            debitMinutes += absVal;
            monthStats.debitMinutes += absVal;
          }

          historicalBalanceSum += dayBalance;
          accountedDays++;
          monthStats.accountedDays++;
        }
      }

      currentIter.setUTCDate(currentIter.getUTCDate() + 1);
    }

    const consolidatedBalanceMinutes = config.initialBalanceMinutes + historicalBalanceSum;
    const liveBalanceMinutes = consolidatedBalanceMinutes + (todayBalanceMinutes ?? 0);

    const monthlyList: BankHoursMonthlySummaryDto[] = Array.from(monthlyMap.entries())
      .map(([m, stats]) => ({
        month: m,
        creditMinutes: stats.creditMinutes,
        debitMinutes: stats.debitMinutes,
        netMinutes: stats.creditMinutes - stats.debitMinutes,
        accountedDays: stats.accountedDays,
        pendingDays: stats.pendingDays,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    return {
      configured: true,
      suggestedStartDate: null,
      config: {
        startDate: startDateStr,
        initialBalanceMinutes: config.initialBalanceMinutes,
      },
      period: {
        startDate: startDateStr,
        endDate: todayStr,
      },
      summary: {
        initialBalanceMinutes: config.initialBalanceMinutes,
        consolidatedBalanceMinutes,
        todayBalanceMinutes,
        liveBalanceMinutes,
        creditMinutes,
        debitMinutes,
        accountedDays,
        pendingDays,
      },
      monthly: monthlyList,
      pending: pendingList,
    };
  }

  async saveConfig(
    userId: string,
    startDateStr: string,
    initialBalanceMinutes: number
  ): Promise<BankHoursResponseDto> {
    const startDateUtc = parseDateToUtcMidnight(startDateStr);
    await bankHoursConfigRepository.upsert(userId, startDateUtc, initialBalanceMinutes);

    return this.getBankHoursStatus(userId);
  }
}

export const bankHoursService = new BankHoursService();

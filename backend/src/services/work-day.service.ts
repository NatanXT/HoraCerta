import { TimeEntryType, Weekday } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import {
  getLocalDateString,
  parseDateToUtcMidnight,
  getWeekdayFromDate,
  getMonthDateRange,
} from '../utils/date';
import { calculateDaySummary } from '../utils/time-calculation';

export interface TimeEntryDto {
  id: string;
  type: TimeEntryType;
  timestamp: Date;
}

export interface WorkDaySummaryDto {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number;
  isOpen: boolean;
  nextAction: TimeEntryType;
  entries: TimeEntryDto[];
}

export type MonthlyDayStatus =
  | 'FUTURE'
  | 'REST_DAY'
  | 'NO_RECORDS'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'RECORDED';

export interface MonthlyDaySummaryDto {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number | null;
  isOpen: boolean;
  status: MonthlyDayStatus;
  entries: TimeEntryDto[];
}

export interface MonthlySummaryDto {
  totalWorkedMinutes: number;
  recordedDays: number;
  incompleteDays: number;
  daysWithoutRecords: number;
}

export interface MonthlyHistoryResponseDto {
  month: string;
  summary: MonthlySummaryDto;
  days: MonthlyDaySummaryDto[];
}

export class WorkDayService {
  async getTodaySummary(): Promise<WorkDaySummaryDto> {
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    return this.getWorkDaySummaryByDateStr(todayStr);
  }

  async getWorkDaySummaryByDateStr(dateStr: string): Promise<WorkDaySummaryDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const dateUtcMidnight = parseDateToUtcMidnight(dateStr);
    const weekday = getWeekdayFromDate(dateStr, env.APP_TIMEZONE);

    const schedule = await workScheduleRepository.findByUserAndWeekday(user.id, weekday);
    const expectedMinutes = schedule ? schedule.expectedMinutes : 0;

    const workDay = await workDayRepository.findByUserAndDate(user.id, dateUtcMidnight);

    if (!workDay) {
      return {
        date: dateStr,
        expectedMinutes,
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: -expectedMinutes,
        isOpen: false,
        nextAction: TimeEntryType.CLOCK_IN,
        entries: [],
      };
    }

    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    const isHistorical = dateStr !== todayStr;

    const summary = calculateDaySummary({
      entries: workDay.timeEntries,
      expectedMinutes,
      now: new Date(),
      isHistorical,
    });

    return {
      date: dateStr,
      expectedMinutes,
      workedMinutes: summary.workedMinutes,
      currentSessionMinutes: summary.currentSessionMinutes,
      totalWorkedMinutes: summary.totalWorkedMinutes,
      balanceMinutes: summary.balanceMinutes,
      isOpen: summary.isOpen,
      nextAction: summary.nextAction,
      entries: workDay.timeEntries.map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
      })),
    };
  }

  async getMonthlySummary(monthStr: string): Promise<MonthlyHistoryResponseDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const { startDate, endDate, daysInMonth, year, month } = getMonthDateRange(monthStr);

    // Single batch query for all WorkDays in the month
    const workDays = await workDayRepository.findByUserAndDateRange(user.id, startDate, endDate);

    // Single batch query for all User WorkSchedules
    const schedules = await workScheduleRepository.findAllByUser(user.id);
    const scheduleMap = new Map<Weekday, number>();
    for (const s of schedules) {
      scheduleMap.set(s.weekday, s.expectedMinutes);
    }

    // Map WorkDays by YYYY-MM-DD date string
    const workDayMap = new Map<string, WorkDayWithEntries>();
    for (const wd of workDays) {
      const dateStr = wd.date.toISOString().substring(0, 10);
      workDayMap.set(dateStr, wd);
    }

    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    const days: MonthlyDaySummaryDto[] = [];

    let totalWorkedMinutes = 0;
    let recordedDays = 0;
    let incompleteDays = 0;
    let daysWithoutRecords = 0;

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const weekday = getWeekdayFromDate(dateStr, env.APP_TIMEZONE);
      const expectedMinutes = scheduleMap.get(weekday) ?? 0;

      const workDay = workDayMap.get(dateStr);
      const hasEntries = !!workDay && workDay.timeEntries.length > 0;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;

      let status: MonthlyDayStatus;
      let balanceMinutes: number | null = null;
      let workedMinutes = 0;
      let currentSessionMinutes = 0;
      let dayTotalWorkedMinutes = 0;
      let isOpen = false;
      let entries: TimeEntryDto[] = [];

      if (isFuture) {
        status = 'FUTURE';
        balanceMinutes = null;
      } else if (!hasEntries) {
        if (expectedMinutes === 0) {
          status = 'REST_DAY';
          balanceMinutes = 0;
        } else {
          status = 'NO_RECORDS';
          balanceMinutes = null;
          daysWithoutRecords++;
        }
      } else {
        recordedDays++;
        entries = workDay.timeEntries.map((e) => ({
          id: e.id,
          type: e.type,
          timestamp: e.timestamp,
        }));

        const calc = calculateDaySummary({
          entries: workDay.timeEntries,
          expectedMinutes,
          now: new Date(),
          isHistorical: !isToday,
        });

        workedMinutes = calc.workedMinutes;
        currentSessionMinutes = calc.currentSessionMinutes;
        dayTotalWorkedMinutes = calc.totalWorkedMinutes;
        balanceMinutes = calc.balanceMinutes;
        isOpen = calc.isOpen;

        totalWorkedMinutes += dayTotalWorkedMinutes;

        const lastEntry = workDay.timeEntries[workDay.timeEntries.length - 1];
        if (lastEntry.type === TimeEntryType.CLOCK_IN) {
          if (isToday) {
            status = 'IN_PROGRESS';
          } else {
            status = 'INCOMPLETE';
            incompleteDays++;
          }
        } else {
          status = 'RECORDED';
        }
      }

      days.push({
        date: dateStr,
        expectedMinutes,
        workedMinutes,
        currentSessionMinutes,
        totalWorkedMinutes: dayTotalWorkedMinutes,
        balanceMinutes,
        isOpen,
        status,
        entries,
      });
    }

    return {
      month: monthStr,
      summary: {
        totalWorkedMinutes,
        recordedDays,
        incompleteDays,
        daysWithoutRecords,
      },
      days,
    };
  }
}

export const workDayService = new WorkDayService();

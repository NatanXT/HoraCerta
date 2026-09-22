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
import { resolveWorkDayState, WorkDayStatus } from '../utils/work-day-status';

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

export type MonthlyDayStatus = WorkDayStatus;

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
    const workDay = await workDayRepository.findByUserAndDate(user.id, dateUtcMidnight);
    const defaultExpected = schedule ? schedule.expectedMinutes : 0;
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);

    const state = resolveWorkDayState({
      dateStr,
      todayStr,
      defaultExpectedMinutes: defaultExpected,
      workDay,
    });

    let nextAction: TimeEntryType = TimeEntryType.CLOCK_IN;
    if (workDay && workDay.timeEntries.length > 0) {
      const summary = calculateDaySummary({
        entries: workDay.timeEntries,
        expectedMinutes: state.expectedMinutes,
        now: new Date(),
        isHistorical: dateStr !== todayStr,
      });
      nextAction = summary.nextAction;
    }

    return {
      date: dateStr,
      expectedMinutes: state.expectedMinutes,
      workedMinutes: state.workedMinutes,
      currentSessionMinutes: state.currentSessionMinutes,
      totalWorkedMinutes: state.totalWorkedMinutes,
      balanceMinutes: state.balanceMinutes ?? -state.expectedMinutes,
      isOpen: state.isOpen,
      nextAction,
      entries: workDay
        ? workDay.timeEntries.map((e) => ({
            id: e.id,
            type: e.type,
            timestamp: e.timestamp,
          }))
        : [],
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
      const workDay = workDayMap.get(dateStr);
      const defaultExpected = scheduleMap.get(weekday) ?? 0;

      const state = resolveWorkDayState({
        dateStr,
        todayStr,
        defaultExpectedMinutes: defaultExpected,
        workDay,
      });

      if (state.hasEntries) {
        recordedDays++;
        totalWorkedMinutes += state.totalWorkedMinutes;
      }

      if (state.status === 'INCOMPLETE') {
        incompleteDays++;
      } else if (state.status === 'NO_RECORDS') {
        daysWithoutRecords++;
      }

      days.push({
        date: dateStr,
        expectedMinutes: state.expectedMinutes,
        workedMinutes: state.workedMinutes,
        currentSessionMinutes: state.currentSessionMinutes,
        totalWorkedMinutes: state.totalWorkedMinutes,
        balanceMinutes: state.balanceMinutes,
        isOpen: state.isOpen,
        status: state.status,
        entries: workDay
          ? workDay.timeEntries.map((e) => ({
              id: e.id,
              type: e.type,
              timestamp: e.timestamp,
            }))
          : [],
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


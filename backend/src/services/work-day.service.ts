import { TimeEntryType, TimeEntrySource, WorkBreakType } from '@prisma/client';
import { env } from '../config/env';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { WorkDayWithEntries } from '../repositories/work-day.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { prisma } from '../lib/prisma';
import {
  getLocalDateString,
  parseDateToUtcMidnight,
  getWeekdayFromCivilDate,
  getMonthDateRange,
} from '../utils/date';
import { calculateDaySummary } from '../utils/time-calculation';
import { resolveWorkDayState, WorkDayStatus } from '../utils/work-day-status';
import { WorkScheduleResolver } from '../utils/work-schedule-resolver';
import { CalendarOccurrenceResolver } from '../utils/calendar-occurrence-resolver';
import {
  CalendarOccurrenceDTO,
  formatCalendarOccurrenceDTO,
} from '../types/calendar-occurrence.dto';

export interface TimeEntryDto {
  id: string;
  type: TimeEntryType;
  timestamp: Date;
  source: TimeEntrySource;
}

export interface WorkBreakDto {
  id: string;
  type: WorkBreakType;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
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
  workBreaks?: WorkBreakDto[];
  occurrence?: CalendarOccurrenceDTO | null;
  session?: any;
  breakSummary?: any;
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
  workBreaks?: WorkBreakDto[];
  occurrence?: CalendarOccurrenceDTO | null;
}

export interface MonthlySummaryDto {
  totalWorkedMinutes: number;
  recordedDays: number;
  incompleteDays: number;
  daysWithoutRecords: number;
  excusedDays: number;
}

export interface MonthlyHistoryResponseDto {
  month: string;
  summary: MonthlySummaryDto;
  days: MonthlyDaySummaryDto[];
}

export class WorkDayService {
  async getTodaySummary(userId: string): Promise<WorkDaySummaryDto> {
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    return this.getWorkDaySummaryByDateStr(userId, todayStr);
  }

  async getWorkDaySummaryByDateStr(userId: string, dateStr: string): Promise<WorkDaySummaryDto> {
    const dateUtcMidnight = parseDateToUtcMidnight(dateStr);
    const weekday = getWeekdayFromCivilDate(dateStr);

    const schedule = await workScheduleRepository.findEffectiveByUserWeekdayAndDate(
      userId,
      weekday,
      dateUtcMidnight
    );

    const workDay = await prisma.workDay.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateUtcMidnight,
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

    const activeOccurrences = await calendarOccurrenceRepository.findActiveInRange(
      userId,
      dateUtcMidnight,
      dateUtcMidnight
    );
    const occurrence = activeOccurrences[0] ?? null;

    const defaultExpected = schedule ? schedule.expectedMinutes : 0;
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);

    const state = resolveWorkDayState({
      dateStr,
      todayStr,
      defaultExpectedMinutes: defaultExpected,
      workDay: workDay as WorkDayWithEntries | null,
      occurrence,
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

    const nowMs = new Date().getTime();
    const breaksDto: WorkBreakDto[] = workDay
      ? workDay.workBreaks.map((b) => {
          const startMs = new Date(b.startedAt).getTime();
          const endMs = b.endedAt ? new Date(b.endedAt).getTime() : nowMs;
          const durationMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
          return {
            id: b.id,
            type: b.type,
            startedAt: b.startedAt.toISOString(),
            endedAt: b.endedAt ? b.endedAt.toISOString() : null,
            durationMinutes,
          };
        })
      : [];

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
            source: e.source,
          }))
        : [],
      workBreaks: breaksDto,
      occurrence: formatCalendarOccurrenceDTO(state.occurrence),
    };
  }

  async getMonthlySummary(userId: string, monthStr: string): Promise<MonthlyHistoryResponseDto> {
    const { startDate, endDate, daysInMonth, year, month } = getMonthDateRange(monthStr);

    const workDays = await prisma.workDay.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
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

    const schedules = await workScheduleRepository.findAllVersionsByUserUntilDate(userId, endDate);
    const scheduleResolver = new WorkScheduleResolver(schedules);

    const occurrences = await calendarOccurrenceRepository.findActiveInRange(
      userId,
      startDate,
      endDate
    );
    const occurrenceResolver = new CalendarOccurrenceResolver(occurrences);

    const workDayMap = new Map<string, (typeof workDays)[0]>();
    for (const wd of workDays) {
      const dateStr = wd.date.toISOString().substring(0, 10);
      workDayMap.set(dateStr, wd);
    }

    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    const days: MonthlyDaySummaryDto[] = [];
    const nowMs = new Date().getTime();

    let totalWorkedMinutes = 0;
    let recordedDays = 0;
    let incompleteDays = 0;
    let daysWithoutRecords = 0;
    let excusedDays = 0;

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const weekday = getWeekdayFromCivilDate(dateStr);
      const dateUtcMidnight = parseDateToUtcMidnight(dateStr);
      const workDay = workDayMap.get(dateStr);
      const occurrence = occurrenceResolver.getForDate(dateStr);

      const defaultExpected = scheduleResolver.getExpectedMinutesForDate(weekday, dateUtcMidnight);

      const state = resolveWorkDayState({
        dateStr,
        todayStr,
        defaultExpectedMinutes: defaultExpected,
        workDay: (workDay as unknown as WorkDayWithEntries) || null,
        occurrence,
      });

      if (state.hasEntries) {
        recordedDays++;
        totalWorkedMinutes += state.totalWorkedMinutes;
      }

      if (state.status === 'EXCUSED') {
        excusedDays++;
      } else if (state.status === 'INCOMPLETE') {
        incompleteDays++;
      } else if (state.status === 'NO_RECORDS') {
        daysWithoutRecords++;
      }

      const breaksDto: WorkBreakDto[] = workDay
        ? workDay.workBreaks.map((b) => {
            const startMs = new Date(b.startedAt).getTime();
            const endMs = b.endedAt ? new Date(b.endedAt).getTime() : nowMs;
            return {
              id: b.id,
              type: b.type,
              startedAt: b.startedAt.toISOString(),
              endedAt: b.endedAt ? b.endedAt.toISOString() : null,
              durationMinutes: Math.max(0, Math.floor((endMs - startMs) / 60000)),
            };
          })
        : [];

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
              source: e.source,
            }))
          : [],
        workBreaks: breaksDto,
        occurrence: formatCalendarOccurrenceDTO(state.occurrence),
      });
    }

    return {
      month: monthStr,
      summary: {
        totalWorkedMinutes,
        recordedDays,
        incompleteDays,
        daysWithoutRecords,
        excusedDays,
      },
      days,
    };
  }
}

export const workDayService = new WorkDayService();

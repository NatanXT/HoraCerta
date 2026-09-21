import { TimeEntryType } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository } from '../repositories/work-day.repository';
import { getLocalDateString, parseDateToUtcMidnight, getWeekdayFromDate } from '../utils/date';
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
}

export const workDayService = new WorkDayService();

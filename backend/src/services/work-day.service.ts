import { TimeEntryType, TimeEntrySource, WorkBreakType, Weekday } from '@prisma/client';
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
  getWeekDateRange,
} from '../utils/date';
import { calculateDaySummary } from '../utils/time-calculation';
import { resolveWorkDayState, WorkDayStatus } from '../utils/work-day-status';
import { WorkScheduleResolver } from '../utils/work-schedule-resolver';
import { CalendarOccurrenceResolver } from '../utils/calendar-occurrence-resolver';
import {
  CalendarOccurrenceDTO,
  formatCalendarOccurrenceDTO,
} from '../types/calendar-occurrence.dto';
import { HolidayDTO, formatHolidayDTO } from '../types/holiday.dto';
import { holidayRepository } from '../repositories/holiday.repository';
import { HolidayResolver } from '../utils/holiday-resolver';

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
  plannedDurationMinutes?: number | null;
  autoResumeAt?: string | null;
  resumedAutomatically?: boolean;
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
  holiday?: HolidayDTO | null;
  session?: any;
  breakSummary?: any;
}

export type MonthlyDayStatus = WorkDayStatus;

export interface MonthlyDaySummaryDto {
  date: string;
  expectedMinutes: number;
  baseExpectedMinutes?: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number | null;
  bankHoursImpactMinutes?: number | null;
  hasManualAdjustments?: boolean;
  isOpen: boolean;
  status: MonthlyDayStatus;
  entries: TimeEntryDto[];
  workBreaks?: WorkBreakDto[];
  occurrence?: CalendarOccurrenceDTO | null;
  holiday?: HolidayDTO | null;
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

export interface WeeklyDaySummaryDto {
  date: string;
  weekday: Weekday;
  weekdayShort: string;
  weekdayLong: string;
  status: MonthlyDayStatus;
  statusLabel: string;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number | null;
  isOpen: boolean;
  hasEntries: boolean;
  entriesCount: number;
  holidayName?: string | null;
  occurrenceType?: string | null;
  occurrenceDescription?: string | null;
}

export interface WeeklySummaryDto {
  startDate: string;
  endDate: string;
  totalWorkedMinutes: number;
  nominalExpectedMinutes: number;
  plannedExpectedMinutes: number;
  applicableExpectedMinutes: number;
  weeklyBalanceMinutes: number;
  recordedDaysCount: number;
  plannedDaysCount: number;
  completedDaysCount: number;
  inProgressDaysCount: number;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  isFutureWeek: boolean;
}

export interface WeeklySummaryResponseDto {
  summary: WeeklySummaryDto;
  days: WeeklyDaySummaryDto[];
  contextualInsight: string;
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

    const holidays = await holidayRepository.findByDateRange(dateUtcMidnight, dateUtcMidnight);
    const holiday = holidays[0] ?? null;

    const defaultExpected = schedule ? schedule.expectedMinutes : 0;
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);

    const state = resolveWorkDayState({
      dateStr,
      todayStr,
      defaultExpectedMinutes: defaultExpected,
      workDay: workDay as WorkDayWithEntries | null,
      occurrence,
      holiday,
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
            plannedDurationMinutes: b.plannedDurationMinutes,
            autoResumeAt: b.autoResumeAt ? b.autoResumeAt.toISOString() : null,
            resumedAutomatically: b.resumedAutomatically,
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
      holiday: formatHolidayDTO(state.holiday),
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

    const holidays = await holidayRepository.findByDateRange(startDate, endDate);
    const holidayResolver = new HolidayResolver(holidays);

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
      const holiday = holidayResolver.getForDate(dateStr);

      const defaultExpected = scheduleResolver.getExpectedMinutesForDate(weekday, dateUtcMidnight);

      const state = resolveWorkDayState({
        dateStr,
        todayStr,
        defaultExpectedMinutes: defaultExpected,
        workDay: (workDay as unknown as WorkDayWithEntries) || null,
        occurrence,
        holiday,
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
              plannedDurationMinutes: b.plannedDurationMinutes,
              autoResumeAt: b.autoResumeAt ? b.autoResumeAt.toISOString() : null,
              resumedAutomatically: b.resumedAutomatically,
            };
          })
        : [];

      const isBankHoursLeave = state.occurrence?.type === 'BANK_HOURS_LEAVE';
      const bankHoursImpactMinutes = isBankHoursLeave ? (state.holiday ? 0 : -defaultExpected) : null;
      const hasManualAdjustments = workDay
        ? workDay.timeEntries.some((e) => e.source === 'MANUAL')
        : false;

      days.push({
        date: dateStr,
        expectedMinutes: state.expectedMinutes,
        baseExpectedMinutes: defaultExpected,
        workedMinutes: state.workedMinutes,
        currentSessionMinutes: state.currentSessionMinutes,
        totalWorkedMinutes: state.totalWorkedMinutes,
        balanceMinutes: state.balanceMinutes,
        bankHoursImpactMinutes,
        hasManualAdjustments,
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
        holiday: formatHolidayDTO(state.holiday),
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

  async getWeeklySummary(userId: string, dateStr: string): Promise<WeeklySummaryResponseDto> {
    const { startDate, endDate, mondayStr, sundayStr } = getWeekDateRange(dateStr);

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

    const holidays = await holidayRepository.findByDateRange(startDate, endDate);
    const holidayResolver = new HolidayResolver(holidays);

    const workDayMap = new Map<string, (typeof workDays)[0]>();
    for (const wd of workDays) {
      const dStr = wd.date.toISOString().substring(0, 10);
      workDayMap.set(dStr, wd);
    }

    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    const days: WeeklyDaySummaryDto[] = [];

    let totalWorkedMinutes = 0;
    let nominalExpectedMinutes = 0;
    let plannedExpectedMinutes = 0;
    let applicableExpectedMinutes = 0;
    let recordedDaysCount = 0;
    let plannedDaysCount = 0;
    let completedDaysCount = 0;
    let inProgressDaysCount = 0;
    let todayHasOpenSession = false;

    const WEEKDAY_NAMES: Record<Weekday, { short: string; long: string }> = {
      [Weekday.MONDAY]: { short: 'Seg', long: 'Segunda-feira' },
      [Weekday.TUESDAY]: { short: 'Ter', long: 'Terça-feira' },
      [Weekday.WEDNESDAY]: { short: 'Qua', long: 'Quarta-feira' },
      [Weekday.THURSDAY]: { short: 'Qui', long: 'Quinta-feira' },
      [Weekday.FRIDAY]: { short: 'Sex', long: 'Sexta-feira' },
      [Weekday.SATURDAY]: { short: 'Sáb', long: 'Sábado' },
      [Weekday.SUNDAY]: { short: 'Dom', long: 'Domingo' },
    };

    const STATUS_LABELS: Record<WorkDayStatus, string> = {
      IN_PROGRESS: 'Em andamento',
      RECORDED: 'Jornada encerrada',
      REST_DAY: 'Folga planejada',
      EXCUSED: 'Ausência abonada',
      NO_RECORDS: 'Sem registros',
      INCOMPLETE: 'Jornada incompleta',
      FUTURE: 'Dia futuro',
    };

    for (let i = 0; i < 7; i++) {
      const currentDayDate = new Date(startDate.getTime() + i * 86400000);
      const dStr = currentDayDate.toISOString().substring(0, 10);
      const weekday = getWeekdayFromCivilDate(dStr);
      const workDay = workDayMap.get(dStr);
      const occurrence = occurrenceResolver.getForDate(dStr);
      const holiday = holidayResolver.getForDate(dStr);

      const defaultExpected = scheduleResolver.getExpectedMinutesForDate(
        weekday,
        currentDayDate
      );

      const state = resolveWorkDayState({
        dateStr: dStr,
        todayStr,
        defaultExpectedMinutes: defaultExpected,
        workDay: (workDay as unknown as WorkDayWithEntries) || null,
        occurrence,
        holiday,
      });

      totalWorkedMinutes += state.totalWorkedMinutes;
      nominalExpectedMinutes += defaultExpected;
      plannedExpectedMinutes += state.expectedMinutes;

      // Applicable expected minutes for weekly balance:
      // Never count future days as debt!
      if (dStr < todayStr) {
        applicableExpectedMinutes += state.expectedMinutes;
      } else if (dStr === todayStr) {
        if (state.hasEntries || state.isOpen || state.status === 'RECORDED' || state.status === 'IN_PROGRESS') {
          applicableExpectedMinutes += state.expectedMinutes;
        }
      } else {
        // Future day: only count if user actually has records logged
        if (state.hasEntries) {
          applicableExpectedMinutes += state.expectedMinutes;
        }
      }

      if (state.hasEntries) {
        recordedDaysCount++;
      }
      if (state.expectedMinutes > 0) {
        plannedDaysCount++;
      }
      if (state.status === 'RECORDED') {
        completedDaysCount++;
      }
      if (state.isOpen || state.status === 'IN_PROGRESS') {
        inProgressDaysCount++;
        if (dStr === todayStr) {
          todayHasOpenSession = true;
        }
      }

      const weekdayMeta = WEEKDAY_NAMES[weekday] || { short: weekday.substring(0, 3), long: weekday };
      const statusLabel = state.holiday
        ? 'Feriado'
        : (STATUS_LABELS[state.status] || state.status);

      days.push({
        date: dStr,
        weekday,
        weekdayShort: weekdayMeta.short,
        weekdayLong: weekdayMeta.long,
        status: state.status,
        statusLabel,
        expectedMinutes: state.expectedMinutes,
        workedMinutes: state.workedMinutes,
        currentSessionMinutes: state.currentSessionMinutes,
        totalWorkedMinutes: state.totalWorkedMinutes,
        balanceMinutes: state.balanceMinutes,
        isOpen: state.isOpen,
        hasEntries: state.hasEntries,
        entriesCount: workDay ? workDay.timeEntries.length : 0,
        holidayName: state.holiday?.name ?? null,
        occurrenceType: state.occurrence?.type ?? null,
        occurrenceDescription: state.occurrence?.note ?? null,
      });
    }

    const weeklyBalanceMinutes = totalWorkedMinutes - applicableExpectedMinutes;
    const isCurrentWeek = todayStr >= mondayStr && todayStr <= sundayStr;
    const isPastWeek = sundayStr < todayStr;
    const isFutureWeek = mondayStr > todayStr;

    const summary: WeeklySummaryDto = {
      startDate: mondayStr,
      endDate: sundayStr,
      totalWorkedMinutes,
      nominalExpectedMinutes,
      plannedExpectedMinutes,
      applicableExpectedMinutes,
      weeklyBalanceMinutes,
      recordedDaysCount,
      plannedDaysCount,
      completedDaysCount,
      inProgressDaysCount,
      isCurrentWeek,
      isPastWeek,
      isFutureWeek,
    };

    const contextualInsight = this.generateContextualInsight(summary, todayHasOpenSession);

    return {
      summary,
      days,
      contextualInsight,
    };
  }

  private generateContextualInsight(
    summary: WeeklySummaryDto,
    todayHasOpenSession: boolean
  ): string {
    const formatHhMm = (minutes: number): string => {
      const abs = Math.abs(minutes);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return `${h}h ${String(m).padStart(2, '0')}min`;
    };

    const formatSignedBalance = (minutes: number): string => {
      if (minutes === 0) return '0h 00min';
      const sign = minutes > 0 ? '+' : '-';
      const abs = Math.abs(minutes);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return `${sign}${h}h ${String(m).padStart(2, '0')}min`;
    };

    const {
      totalWorkedMinutes,
      plannedExpectedMinutes,
      weeklyBalanceMinutes,
      recordedDaysCount,
      plannedDaysCount,
      isPastWeek,
      isFutureWeek,
    } = summary;

    if (isFutureWeek) {
      if (plannedDaysCount > 0) {
        return `Semana futura: carga horária planejada de ${formatHhMm(plannedExpectedMinutes)} distribuída em ${plannedDaysCount} dias.`;
      }
      return 'Semana futura sem dias de expediente planejados.';
    }

    if (isPastWeek) {
      if (recordedDaysCount > 0) {
        return `Semana encerrada com ${formatHhMm(totalWorkedMinutes)} trabalhadas em ${recordedDaysCount} dias com registros (saldo apurado: ${formatSignedBalance(weeklyBalanceMinutes)}).`;
      }
      return 'Nenhum registro de ponto cadastrado nesta semana anterior.';
    }

    // Current week
    if (todayHasOpenSession) {
      return `Sua jornada de hoje ainda está em andamento. Você já registrou ${formatHhMm(totalWorkedMinutes)} nesta semana.`;
    }

    if (plannedExpectedMinutes > 0 && totalWorkedMinutes >= plannedExpectedMinutes) {
      return `Meta semanal concluída! Você registrou ${formatHhMm(totalWorkedMinutes)} de ${formatHhMm(plannedExpectedMinutes)} planejadas.`;
    }

    if (recordedDaysCount > 0) {
      return `Você já registrou ${formatHhMm(totalWorkedMinutes)} nesta semana (${recordedDaysCount} de ${plannedDaysCount} dias planejados com registros).`;
    }

    if (plannedDaysCount > 0) {
      return `Esta semana possui ${plannedDaysCount} dias planejados (${formatHhMm(plannedExpectedMinutes)} no total). Registre seu ponto ao iniciar o expediente.`;
    }

    return 'Semana sem jornada de trabalho configurada no perfil.';
  }
}

export const workDayService = new WorkDayService();

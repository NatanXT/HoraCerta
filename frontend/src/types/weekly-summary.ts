import { MonthlyDayStatus } from './work-day';

export type WeeklyDayStatus = MonthlyDayStatus;

export interface WeeklyDaySummary {
  date: string; // YYYY-MM-DD
  weekday: string; // 'MONDAY' .. 'SUNDAY'
  weekdayShort: string; // 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'
  weekdayLong: string; // 'Segunda-feira', ...
  status: WeeklyDayStatus;
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

export interface WeeklySummary {
  startDate: string; // Monday YYYY-MM-DD
  endDate: string; // Sunday YYYY-MM-DD
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

export interface WeeklySummaryResponse {
  summary: WeeklySummary;
  days: WeeklyDaySummary[];
  contextualInsight: string;
}

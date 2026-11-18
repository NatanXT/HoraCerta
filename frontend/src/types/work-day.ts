import { CalendarOccurrence } from './calendar-occurrence';
import { Holiday } from './holiday';

export type TimeEntryType = 'CLOCK_IN' | 'CLOCK_OUT';

export interface TimeEntry {
  id: string;
  type: TimeEntryType;
  timestamp: string;
  source?: 'CLOCK' | 'MANUAL';
}

export interface WorkBreak {
  id: string;
  type: 'SNACK' | 'LUNCH';
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
}

export interface WorkDaySummary {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number;
  isOpen: boolean;
  nextAction: TimeEntryType;
  entries: TimeEntry[];
  workBreaks?: WorkBreak[];
  occurrence?: CalendarOccurrence | null;
  holiday?: Holiday | null;
}

export type MonthlyDayStatus =
  | 'FUTURE'
  | 'REST_DAY'
  | 'NO_RECORDS'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'RECORDED'
  | 'EXCUSED'
  | 'DATA_UNAVAILABLE';

export interface MonthlyDaySummary {
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
  entries: TimeEntry[];
  workBreaks?: WorkBreak[];
  occurrence?: CalendarOccurrence | null;
  holiday?: Holiday | null;
}

export interface MonthlyHistorySummary {
  totalWorkedMinutes: number;
  recordedDays: number;
  incompleteDays: number;
  daysWithoutRecords: number;
  excusedDays: number;
}

export interface MonthlyHistoryResponse {
  month: string;
  summary: MonthlyHistorySummary;
  days: MonthlyDaySummary[];
}

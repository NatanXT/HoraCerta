import { CalendarOccurrence } from './calendar-occurrence';

export type TimeEntryType = 'CLOCK_IN' | 'CLOCK_OUT';

export interface TimeEntry {
  id: string;
  type: TimeEntryType;
  timestamp: string;
  source?: 'CLOCK' | 'MANUAL';
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
  occurrence?: CalendarOccurrence | null;
}

export type MonthlyDayStatus =
  | 'FUTURE'
  | 'REST_DAY'
  | 'NO_RECORDS'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'RECORDED'
  | 'EXCUSED';

export interface MonthlyDaySummary {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number | null;
  isOpen: boolean;
  status: MonthlyDayStatus;
  entries: TimeEntry[];
  occurrence?: CalendarOccurrence | null;
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

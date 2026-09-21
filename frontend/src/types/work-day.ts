export type TimeEntryType = 'CLOCK_IN' | 'CLOCK_OUT';

export interface TimeEntry {
  id: string;
  type: TimeEntryType;
  timestamp: string;
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
}

export type MonthlyDayStatus =
  | 'FUTURE'
  | 'REST_DAY'
  | 'NO_RECORDS'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'RECORDED';

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
}

export interface MonthlyHistorySummary {
  totalWorkedMinutes: number;
  recordedDays: number;
  incompleteDays: number;
  daysWithoutRecords: number;
}

export interface MonthlyHistoryResponse {
  month: string;
  summary: MonthlyHistorySummary;
  days: MonthlyDaySummary[];
}

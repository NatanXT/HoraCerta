import { CalendarOccurrenceType } from './calendar-occurrence';
import { TimeEntry, MonthlyDayStatus } from './work-day';

export interface ReportOccurrenceInfo {
  id: string;
  type: CalendarOccurrenceType | string;
  title: string;
  startDate: string;
  endDate: string;
  note: string | null;
}

export interface ReportDay {
  date: string;
  weekday: string;
  status: MonthlyDayStatus;
  baseExpectedMinutes: number;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number | null;
  isBankAccounted: boolean;
  isProvisional: boolean;
  occurrence: ReportOccurrenceInfo | null;
  entrySource: 'CLOCK' | 'MANUAL' | 'MIXED' | null;
  entries: TimeEntry[];
}

export interface ReportPeriod {
  from: string;
  to: string;
  generatedAt: string;
  timezone: string;
  hasProvisionalData: boolean;
}

export interface ReportSummary {
  calendarDays: number;
  scheduledMinutes: number;
  workedMinutes: number;
  recordedDays: number;
  excusedDays: number;
  restDays: number;
  noRecordsDays: number;
  incompleteDays: number;
  inProgressDays: number;
  futureDays: number;
  pendingDays: number;
}

export interface ReportBankHours {
  configured: boolean;
  startDate: string | null;
  periodCreditMinutes: number | null;
  periodDebitMinutes: number | null;
  periodConsolidatedBalanceMinutes: number | null;
  accountedDays: number;
  provisionalTodayBalanceMinutes: number | null;
  livePeriodBalanceMinutes: number | null;
}

export interface ReportOccurrenceTypeSummary {
  type: CalendarOccurrenceType | string;
  days: number;
}

export interface ReportOccurrenceSummary {
  totalOccurrenceDays: number;
  byType: ReportOccurrenceTypeSummary[];
}

export interface WorkHoursReport {
  period: ReportPeriod;
  summary: ReportSummary;
  bankHours: ReportBankHours;
  occurrences: ReportOccurrenceSummary;
  days: ReportDay[];
}

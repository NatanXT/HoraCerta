import { MonthlyDaySummary } from '../../types/work-day';

export type AnalyticsPeriodPreset = 'current-month' | 'last-3-months' | 'last-6-months' | 'custom';

export interface AnalyticsDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface AnalyticsPeriodFilterState {
  preset: AnalyticsPeriodPreset;
  range: AnalyticsDateRange;
}

export type BankHoursAvailabilityStatus =
  | 'configured'
  | 'unconfigured'
  | 'partial_interval_unavailable'
  | 'statement_incomplete'
  | 'error';

export interface AnalyticsSummaryMetrics {
  totalWorkedMinutes: number;
  totalExpectedMinutes: number;
  netDifferenceMinutes: number;
  recordedDaysCount: number;
  averageWorkedMinutesPerRecordedDay: number;
  officialBankHoursNetMinutes: number | null; // null if not configured, or if range is partial month, or error
  bankHoursAvailability: BankHoursAvailabilityStatus;
  bankHoursAvailabilityReason?: string;
  isBankHoursConfigured: boolean;
  isPartialCoverage: boolean; // true if any month failed or had unavailable days
  coverageDaysCount: number;  // days available with valid data
  totalDaysInRange: number;   // total calendar days in range
}

export type MonthlyAggregationStatus = 'available' | 'partial' | 'unavailable' | 'empty';

export interface MonthlyAggregationItem {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Nov/2026"
  status: MonthlyAggregationStatus;
  isCurrentMonth: boolean;
  isFractionOfCompetence: boolean; // true if the active filter range only covers a partial fraction of this month
  totalWorkedMinutes: number | null; // null if status === 'unavailable'
  totalExpectedMinutes: number | null; // null if status === 'unavailable'
  differenceMinutes: number | null; // null if status === 'unavailable'
  recordedDaysCount: number | null; // null if status === 'unavailable'
  bankHoursNetMinutes: number | null;
  bankHoursCumulativeClosingBalance: number | null;
  isBankHoursActiveInMonth: boolean;
  hasIncompleteData: boolean;
  unavailableReason?: string;
}

export interface DailyBalanceDistribution {
  positiveDaysCount: number;
  negativeDaysCount: number;
  balancedDaysCount: number;
  unaccountedDaysCount: number;
  unavailableDaysCount: number;
  inProgressDaysCount: number;
  totalAccountedDays: number;
  totalCalendarDays: number;
}

export type BankHoursPointStatus =
  | 'closed'
  | 'in_progress'
  | 'unconfirmed'
  | 'unconfigured'
  | 'unavailable';

export interface BankHoursEvolutionPoint {
  month: string;
  monthLabel: string;
  status: BankHoursPointStatus;
  isConfiguredPeriod: boolean;
  isCurrentMonth: boolean;
  closingBalanceMinutes: number | null;
  monthlyNetMinutes: number | null;
  creditMinutes: number | null;
  debitMinutes: number | null;
}

export interface WorkAnalyticsData {
  range: AnalyticsDateRange;
  filteredDays: MonthlyDaySummary[];
  summaryMetrics: AnalyticsSummaryMetrics;
  monthlyAggregations: MonthlyAggregationItem[];
  dailyBalanceDistribution: DailyBalanceDistribution;
  bankHoursEvolution: BankHoursEvolutionPoint[];
  partialMonths: string[]; // List of months that had partial days
  failedMonths: string[];  // List of months that completely failed
  bankHoursStatus: 'configured' | 'unconfigured' | 'error';
  isBankHoursConfigured: boolean;
  bankHoursConfigStartDate: string | null;
  isCustomPartialMonthRange: boolean;
}

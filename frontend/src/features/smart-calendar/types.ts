import { MonthlyDaySummary } from '../../types/work-day';

export type CalendarViewMode = 'calendar' | 'list';

export interface DayIndicators {
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isCompletedWorkday: boolean;
  isOpenWorkday: boolean;
  isRestDay: boolean;
  isHoliday: boolean;
  isVacation: boolean;
  isAbsenceOrLeave: boolean;
  isPositiveBalance: boolean;
  isNegativeBalance: boolean;
  isZeroBalance: boolean;
  hasManualAdjustment: boolean;
  isPendingOrIncomplete: boolean;
  hasEntries: boolean;
  isDataUnavailable: boolean;
}

export interface SmartCalendarDay {
  summary: MonthlyDaySummary;
  dayNumber: number;
  weekdayShort: string;
  weekdayLong: string;
  indicators: DayIndicators;
  ariaLabel: string;
}

export interface SmartCalendarGridData {
  monthStr: string;
  year: number;
  month: number;
  daysInMonth: number;
  leadInSlots: number;
  leadOutSlots: number;
  days: SmartCalendarDay[];
}

import { Holiday } from '../../types/holiday';
import { CalendarOccurrence } from '../../types/calendar-occurrence';
import { WorkScheduleDay } from '../../types/settings';

export type SimulationMode = 'TARGET_DATE' | 'DAILY_ADDITION';

export type EligibleDayStatus =
  | 'ELIGIBLE'
  | 'SCHEDULE_OFF'
  | 'HOLIDAY'
  | 'OCCURRENCE';

export type CalendarStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CalendarErrorDetail {
  source: 'settings' | 'holidays' | 'occurrences' | 'schedule' | 'generic';
  message: string;
}

export interface CalendarContextData {
  userId: string;
  targetDateStr: string;
  workScheduleDays?: WorkScheduleDay[];
  holidays?: Holiday[];
  occurrences?: CalendarOccurrence[];
}

export interface EligibleDayDetail {
  date: string; // YYYY-MM-DD
  weekday: string; // 'MONDAY', etc.
  status: EligibleDayStatus;
  reason?: string; // e.g. "Folga semanal", "Feriado: Tiradentes", "Férias"
  expectedMinutes: number;
}

export interface CompensationSimulationInput {
  currentBalanceMinutes: number;
  targetBalanceMinutes: number | null; // null if user input is invalid
  targetDateStr: string;
  dailyAdditionMinutes: number;
  mode: SimulationMode;
}

export interface CalendarBreakdown {
  totalCalendarDays: number;
  eligibleDaysCount: number;
  scheduleOffDaysCount: number;
  holidayDaysCount: number;
  occurrenceDaysCount: number;
}

export interface SimulationValidationErrors {
  targetBalanceError?: string | null;
  dateRangeError?: string | null;
  scheduleError?: string | null;
  dailyAdditionError?: string | null;
}

export interface CompensationSimulationResult {
  isValid: boolean;
  validationErrors: SimulationValidationErrors;
  currentBalanceMinutes: number;
  targetBalanceMinutes: number;
  targetDateStr: string;
  mode: SimulationMode;
  breakdown: CalendarBreakdown;
  eligibleDaysList: EligibleDayDetail[];
  minutesToCompensate: number;
  isTargetAchieved: boolean;
  hasEligibleDays: boolean;

  // Mode A specifics (calcular acréscimo diário)
  suggestedDailyMinutes: number;
  projectedBalanceModeA: number;

  // Mode B specifics (compensar acréscimo fixo por dia)
  dailyAdditionMinutes: number;
  totalCompensatedModeB: number;
  projectedBalanceModeB: number;
  differenceFromTargetModeB: number;
  targetReachedDateModeB: string | null;
}

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

/**
 * Status da meta de compensação em relação ao saldo oficial atual.
 */
export type GoalStatus =
  | 'NOT_STARTED' // Saldo oficial atual é idêntico ao saldo inicial (baseline)
  | 'IN_PROGRESS' // Evolução positiva parcial em direção ao objetivo (0 < progresso < 100%)
  | 'COMPLETED' // Saldo oficial atual atingiu ou ultrapassou a meta
  | 'REGRESSED' // Saldo oficial atual piorou em relação ao baseline inicial
  | 'EXPIRED'; // Prazo limite civil expirou sem conclusão da meta

/**
 * Representação da meta de compensação salva localmente por usuário.
 */
export interface SavedBankHoursGoal {
  id: string;
  userId: string;
  title?: string;
  targetBalanceMinutes: number;
  targetDateStr: string; // YYYY-MM-DD
  dailyAdditionMinutes?: number;
  mode: SimulationMode;
  baselineBalanceMinutes: number; // Saldo oficial no momento em que a meta foi definida
  createdAtStr: string; // Data civil de criação YYYY-MM-DD
  createdAtTimestamp: number; // Timestamp da criação
}

/**
 * Resultado do cálculo do progresso da meta ativa em tempo real.
 */
export interface GoalProgressResult {
  status: GoalStatus;
  isAchieved: boolean;
  isExpired: boolean;
  progressPercentage: number; // 0 a 100 inteiro
  baselineBalanceMinutes: number;
  currentBalanceMinutes: number;
  targetBalanceMinutes: number;
  remainingMinutes: number; // Minutos restantes para atingir a meta (>= 0)
  netEvolutionMinutes: number; // currentBalanceMinutes - baselineBalanceMinutes
  totalSpanMinutes: number; // targetBalanceMinutes - baselineBalanceMinutes
  daysRemainingCivil: number; // Dias civis restantes até a data limite
}

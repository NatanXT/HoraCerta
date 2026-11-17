import { Holiday } from '../../types/holiday';
import { CalendarOccurrence } from '../../types/calendar-occurrence';
import { Weekday, WorkScheduleDay } from '../../types/settings';
import { getWeekdayFromCivilDate } from '../../utils/date';
import {
  CompensationSimulationInput,
  CompensationSimulationResult,
  EligibleDayDetail,
  CalendarBreakdown,
  CalendarContextData,
  SimulationValidationErrors,
} from './types';

/**
 * All 7 canonical weekdays required for a complete work schedule.
 */
export const ALL_WEEKDAYS: readonly Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

/**
 * Validates whether a date string is a real, existing civil date in YYYY-MM-DD format.
 * Uses UTC Date round-trip to detect impossible dates (e.g. 2026-02-30, 2026-11-31).
 */
export function isValidCivilDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates the full canonical contract of a work schedule.
 * Requires all 7 weekdays with no duplicates, and expectedMinutes must be non-negative integers.
 */
export function validateWorkSchedule(
  days?: WorkScheduleDay[] | null
): { isValid: boolean; errorMessage?: string } {
  if (!days || !Array.isArray(days) || days.length !== 7) {
    return {
      isValid: false,
      errorMessage:
        'Configuração de expediente incompleta ou inválida. É necessário definir todos os 7 dias da semana.',
    };
  }

  const seenWeekdays = new Set<Weekday>();

  for (const day of days) {
    if (!day || !ALL_WEEKDAYS.includes(day.weekday)) {
      return {
        isValid: false,
        errorMessage:
          'Configuração de expediente contém dias da semana inválidos.',
      };
    }

    if (seenWeekdays.has(day.weekday)) {
      return {
        isValid: false,
        errorMessage:
          'Configuração de expediente contém dias da semana duplicados.',
      };
    }
    seenWeekdays.add(day.weekday);

    if (
      typeof day.expectedMinutes !== 'number' ||
      !Number.isFinite(day.expectedMinutes) ||
      !Number.isInteger(day.expectedMinutes) ||
      day.expectedMinutes < 0
    ) {
      return {
        isValid: false,
        errorMessage:
          'Configuração de expediente contém carga horária inválida (deve ser um número inteiro maior ou igual a zero).',
      };
    }
  }

  if (seenWeekdays.size !== 7) {
    return {
      isValid: false,
      errorMessage:
        'Configuração de expediente incompleta ou inválida. É necessário definir todos os 7 dias da semana.',
    };
  }

  return { isValid: true };
}

/**
 * Adds days to a civil date string YYYY-MM-DD safely without timezone shifts.
 * Returns empty string if input date is not a valid civil date.
 */
export function addDaysCivilDate(dateStr: string, days: number): string {
  if (!isValidCivilDate(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().substring(0, 10);
}

/**
 * Generates an array of all civil dates from startDateStr to endDateStr inclusive.
 * Validates both boundary dates before generation.
 */
export function generateCivilDateRange(startDateStr: string, endDateStr: string): string[] {
  if (!isValidCivilDate(startDateStr) || !isValidCivilDate(endDateStr)) return [];
  if (startDateStr > endDateStr) return [];
  const dates: string[] = [];
  let current = startDateStr;
  while (current <= endDateStr) {
    dates.push(current);
    current = addDaysCivilDate(current, 1);
  }
  return dates;
}

/**
 * Checks whether an occurrence relieves expected working hours on that day.
 */
export function isRelievingOccurrence(occurrence: CalendarOccurrence): boolean {
  const relievingTypes = [
    'HOLIDAY',
    'VACATION',
    'MEDICAL_LEAVE',
    'JUSTIFIED_ABSENCE',
    'EXCEPTIONAL_DAY_OFF',
    'BANK_HOURS_LEAVE',
  ];
  return relievingTypes.includes(occurrence.type);
}

/**
 * Resolves the eligibility details for a specific civil date.
 */
export function resolveDayEligibility(
  dateStr: string,
  scheduleMap: Map<Weekday, number>,
  holidaysMap: Map<string, Holiday>,
  occurrences: CalendarOccurrence[]
): EligibleDayDetail {
  const weekdayKey = getWeekdayFromCivilDate(dateStr) as Weekday;
  const expectedMinutes = scheduleMap.get(weekdayKey) ?? 0;

  // 1. Check if it's a scheduled working day
  if (expectedMinutes <= 0) {
    const isWeekend = weekdayKey === 'SATURDAY' || weekdayKey === 'SUNDAY';
    return {
      date: dateStr,
      weekday: weekdayKey,
      status: 'SCHEDULE_OFF',
      reason: isWeekend ? 'Folga de fim de semana' : 'Sem expediente previsto',
      expectedMinutes: 0,
    };
  }

  // 2. Check if it's a registered holiday
  const holiday = holidaysMap.get(dateStr);
  if (holiday) {
    return {
      date: dateStr,
      weekday: weekdayKey,
      status: 'HOLIDAY',
      reason: `Feriado: ${holiday.name}`,
      expectedMinutes,
    };
  }

  // 3. Check if there is an active calendar occurrence (vacation, medical leave, etc.)
  const matchingOccurrence = occurrences.find((occ) => {
    return isRelievingOccurrence(occ) && dateStr >= occ.startDate && dateStr <= occ.endDate;
  });

  if (matchingOccurrence) {
    return {
      date: dateStr,
      weekday: weekdayKey,
      status: 'OCCURRENCE',
      reason: matchingOccurrence.title || 'Ausência / Ocorrência cadastrada',
      expectedMinutes,
    };
  }

  // 4. Eligible normal working day
  return {
    date: dateStr,
    weekday: weekdayKey,
    status: 'ELIGIBLE',
    expectedMinutes,
  };
}

/**
 * Evaluates the full calendar range between tomorrow (startDateStr) and targetDateStr.
 * Requires a valid work schedule. Does NOT invent default schedules.
 */
export function evaluateCalendarInterval(
  startDateStr: string,
  targetDateStr: string,
  calendarData: CalendarContextData
): { breakdown: CalendarBreakdown; daysList: EligibleDayDetail[] } {
  const scheduleValidation = validateWorkSchedule(calendarData.workScheduleDays);
  if (!scheduleValidation.isValid) {
    return { breakdown: createEmptyBreakdown(), daysList: [] };
  }

  const scheduleMap = new Map<Weekday, number>();
  for (const d of calendarData.workScheduleDays!) {
    scheduleMap.set(d.weekday, d.expectedMinutes);
  }

  const holidaysMap = new Map<string, Holiday>();
  if (calendarData.holidays) {
    for (const h of calendarData.holidays) {
      holidaysMap.set(h.date, h);
    }
  }

  const occurrences = calendarData.occurrences || [];
  const dateRange = generateCivilDateRange(startDateStr, targetDateStr);

  const daysList: EligibleDayDetail[] = [];
  let eligibleDaysCount = 0;
  let scheduleOffDaysCount = 0;
  let holidayDaysCount = 0;
  let occurrenceDaysCount = 0;

  for (const d of dateRange) {
    const detail = resolveDayEligibility(d, scheduleMap, holidaysMap, occurrences);
    daysList.push(detail);

    switch (detail.status) {
      case 'ELIGIBLE':
        eligibleDaysCount++;
        break;
      case 'SCHEDULE_OFF':
        scheduleOffDaysCount++;
        break;
      case 'HOLIDAY':
        holidayDaysCount++;
        break;
      case 'OCCURRENCE':
        occurrenceDaysCount++;
        break;
    }
  }

  const breakdown: CalendarBreakdown = {
    totalCalendarDays: dateRange.length,
    eligibleDaysCount,
    scheduleOffDaysCount,
    holidayDaysCount,
    occurrenceDaysCount,
  };

  return { breakdown, daysList };
}

/**
 * Returns an empty breakdown.
 */
function createEmptyBreakdown(): CalendarBreakdown {
  return {
    totalCalendarDays: 0,
    eligibleDaysCount: 0,
    scheduleOffDaysCount: 0,
    holidayDaysCount: 0,
    occurrenceDaysCount: 0,
  };
}

/**
 * Calculates the complete compensation simulation based on user inputs and calendar evaluation.
 * Rejects invalid inputs, invalid dates, and missing schedule configurations.
 */
export function calculateCompensationSimulation(
  input: CompensationSimulationInput,
  calendarData: CalendarContextData,
  todayStr: string
): CompensationSimulationResult {
  const {
    currentBalanceMinutes,
    targetBalanceMinutes,
    targetDateStr,
    dailyAdditionMinutes,
    mode,
  } = input;

  const validationErrors: SimulationValidationErrors = {};

  // 1. Validate Target Balance Input
  if (targetBalanceMinutes === null || isNaN(targetBalanceMinutes)) {
    validationErrors.targetBalanceError =
      'Formato de meta de saldo inválido. Utilize o formato HH:MM (ex: 00:00, +02:00, -01:15).';
  }

  // 2. Validate Civil Dates and Target Date Range
  const tomorrowStr = addDaysCivilDate(todayStr, 1);
  const maxAllowedDate = addDaysCivilDate(todayStr, 365);

  if (!isValidCivilDate(todayStr)) {
    validationErrors.dateRangeError = 'Data de referência atual inválida.';
  } else if (!isValidCivilDate(targetDateStr)) {
    validationErrors.dateRangeError = 'Data limite inválida ou inexistente no calendário.';
  } else {
    if (targetDateStr <= todayStr) {
      validationErrors.dateRangeError =
        'A data limite deve ser posterior à data atual (a partir de amanhã).';
    } else if (targetDateStr > maxAllowedDate) {
      validationErrors.dateRangeError =
        'O prazo selecionado excede o limite máximo permitido de projeção (365 dias).';
    }
  }

  // 3. Validate Work Schedule Presence and Canonical 7 Weekdays
  const scheduleValidation = validateWorkSchedule(calendarData.workScheduleDays);
  if (!scheduleValidation.isValid) {
    validationErrors.scheduleError =
      scheduleValidation.errorMessage ||
      'Configuração de expediente incompleta ou inválida. É necessário definir todos os 7 dias da semana.';
  }

  // 4. Validate Mode B Daily Addition
  if (mode === 'DAILY_ADDITION') {
    if (isNaN(dailyAdditionMinutes) || dailyAdditionMinutes <= 0) {
      validationErrors.dailyAdditionError =
        'Informe um valor de acréscimo diário válido maior que zero.';
    } else if (dailyAdditionMinutes > 480) {
      validationErrors.dailyAdditionError =
        'O acréscimo diário excede o limite máximo suportado pela interface (480 min).';
    }
  }

  const hasErrors = Object.values(validationErrors).some((v) => Boolean(v));

  // If validation failed, return invalid result without computing misleading numbers
  if (hasErrors) {
    return {
      isValid: false,
      validationErrors,
      currentBalanceMinutes,
      targetBalanceMinutes: targetBalanceMinutes ?? 0,
      targetDateStr,
      mode,
      breakdown: createEmptyBreakdown(),
      eligibleDaysList: [],
      minutesToCompensate: 0,
      isTargetAchieved: false,
      hasEligibleDays: false,
      suggestedDailyMinutes: 0,
      projectedBalanceModeA: currentBalanceMinutes,
      dailyAdditionMinutes: dailyAdditionMinutes || 0,
      totalCompensatedModeB: 0,
      projectedBalanceModeB: currentBalanceMinutes,
      differenceFromTargetModeB: 0,
      targetReachedDateModeB: null,
    };
  }

  // Effective calculation with verified schedule and valid dates
  const effectiveStartDateStr = tomorrowStr <= targetDateStr ? tomorrowStr : targetDateStr;

  const { breakdown, daysList } = evaluateCalendarInterval(
    effectiveStartDateStr,
    targetDateStr,
    calendarData
  );

  const safeTargetBalance = targetBalanceMinutes!;
  const minutesToCompensate = Math.max(0, safeTargetBalance - currentBalanceMinutes);
  const isTargetAchieved = currentBalanceMinutes >= safeTargetBalance;
  const hasEligibleDays = breakdown.eligibleDaysCount > 0;

  // Mode A: Calculate required daily addition to reach target
  let suggestedDailyMinutes = 0;
  let projectedBalanceModeA = currentBalanceMinutes;

  if (isTargetAchieved) {
    suggestedDailyMinutes = 0;
    projectedBalanceModeA = currentBalanceMinutes;
  } else if (hasEligibleDays) {
    suggestedDailyMinutes = Math.ceil(minutesToCompensate / breakdown.eligibleDaysCount);
    projectedBalanceModeA =
      currentBalanceMinutes + suggestedDailyMinutes * breakdown.eligibleDaysCount;
  } else {
    suggestedDailyMinutes = 0;
    projectedBalanceModeA = currentBalanceMinutes;
  }

  // Mode B: Calculate projected outcome with user-chosen daily addition
  const safeDailyAddition = Math.max(0, Math.round(dailyAdditionMinutes || 0));
  const totalCompensatedModeB = safeDailyAddition * breakdown.eligibleDaysCount;
  const projectedBalanceModeB = currentBalanceMinutes + totalCompensatedModeB;
  const differenceFromTargetModeB = projectedBalanceModeB - safeTargetBalance;

  let targetReachedDateModeB: string | null = null;
  if (isTargetAchieved) {
    targetReachedDateModeB = todayStr;
  } else if (safeDailyAddition > 0) {
    let accumulated = currentBalanceMinutes;
    for (const day of daysList) {
      if (day.status === 'ELIGIBLE') {
        accumulated += safeDailyAddition;
        if (accumulated >= safeTargetBalance) {
          targetReachedDateModeB = day.date;
          break;
        }
      }
    }
  }

  return {
    isValid: true,
    validationErrors: {},
    currentBalanceMinutes,
    targetBalanceMinutes: safeTargetBalance,
    targetDateStr,
    mode,
    breakdown,
    eligibleDaysList: daysList,
    minutesToCompensate,
    isTargetAchieved,
    hasEligibleDays,

    // Mode A
    suggestedDailyMinutes,
    projectedBalanceModeA,

    // Mode B
    dailyAdditionMinutes: safeDailyAddition,
    totalCompensatedModeB,
    projectedBalanceModeB,
    differenceFromTargetModeB,
    targetReachedDateModeB,
  };
}

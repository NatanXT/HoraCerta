import { MonthlyDaySummary } from '../../types/work-day';
import { DayIndicators, SmartCalendarDay, SmartCalendarGridData } from './types';
import { formatMinutes, formatBalance } from '../../utils/time';

export const WEEKDAY_HEADERS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const WEEKDAY_NAMES_MAP: Record<number, { short: string; long: string }> = {
  0: { short: 'Dom', long: 'Domingo' },
  1: { short: 'Seg', long: 'Segunda-feira' },
  2: { short: 'Ter', long: 'Terça-feira' },
  3: { short: 'Qua', long: 'Quarta-feira' },
  4: { short: 'Qui', long: 'Quinta-feira' },
  5: { short: 'Sex', long: 'Sexta-feira' },
  6: { short: 'Sáb', long: 'Sábado' },
};

/**
 * Checks whether a given year is a leap year (ano bissexto).
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the exact number of days in a civil month (1-12), accurately accounting for leap years.
 */
export function getDaysInCivilMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

/**
 * Gets short and long Portuguese weekday names for a civil date string 'YYYY-MM-DD'.
 */
export function getWeekdayNamesForDate(dateStr: string): { short: string; long: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = utcDate.getUTCDay();
  return WEEKDAY_NAMES_MAP[dayOfWeek] || { short: '', long: '' };
}

/**
 * Resolves all coexisting, independent indicators for a given day summary.
 */
export function resolveDayIndicators(day: MonthlyDaySummary, todayStr: string): DayIndicators {
  const isDataUnavailable = day.status === 'DATA_UNAVAILABLE';
  const isToday = day.date === todayStr;
  const isPast = day.date < todayStr;
  const isFuture = !isDataUnavailable && (day.date > todayStr || day.status === 'FUTURE');

  if (isDataUnavailable) {
    return {
      isToday,
      isPast,
      isFuture: false,
      isCompletedWorkday: false,
      isOpenWorkday: false,
      isRestDay: false,
      isHoliday: false,
      isVacation: false,
      isAbsenceOrLeave: false,
      isPositiveBalance: false,
      isNegativeBalance: false,
      isZeroBalance: false,
      hasManualAdjustment: false,
      isPendingOrIncomplete: false,
      hasEntries: false,
      isDataUnavailable: true,
    };
  }

  const hasEntries = Array.isArray(day.entries) && day.entries.length > 0;
  const isOpenWorkday = day.isOpen === true || day.status === 'IN_PROGRESS';
  const isCompletedWorkday =
    day.status === 'RECORDED' ||
    (!day.isOpen && day.totalWorkedMinutes > 0 && hasEntries);

  const isHoliday = Boolean(day.holiday);
  const isVacation = Boolean(day.occurrence && day.occurrence.type === 'VACATION');
  const isAbsenceOrLeave = Boolean(
    day.occurrence &&
      day.occurrence.type !== 'VACATION' &&
      day.occurrence.type !== 'HOLIDAY'
  );

  const isRestDay =
    day.status === 'REST_DAY' ||
    (day.expectedMinutes === 0 && day.status !== 'EXCUSED' && !isHoliday && !isVacation && !isAbsenceOrLeave);

  const hasBalance = day.balanceMinutes !== null && typeof day.balanceMinutes === 'number';
  const isPositiveBalance = Boolean(hasBalance && (day.balanceMinutes as number) > 0);
  const isNegativeBalance = Boolean(hasBalance && (day.balanceMinutes as number) < 0);
  const isZeroBalance = Boolean(
    hasBalance &&
      day.balanceMinutes === 0 &&
      (day.totalWorkedMinutes > 0 || day.expectedMinutes > 0)
  );

  const hasManualAdjustment = Boolean(
    day.hasManualAdjustments ||
      (hasEntries && day.entries.some((e) => e.source === 'MANUAL'))
  );

  const isPendingOrIncomplete = day.status === 'INCOMPLETE';

  return {
    isToday,
    isPast,
    isFuture,
    isCompletedWorkday,
    isOpenWorkday,
    isRestDay,
    isHoliday,
    isVacation,
    isAbsenceOrLeave,
    isPositiveBalance,
    isNegativeBalance,
    isZeroBalance,
    hasManualAdjustment,
    isPendingOrIncomplete,
    hasEntries,
    isDataUnavailable: false,
  };
}

/**
 * Synthesizes a comprehensive, accessible human-readable aria-label combining all active properties.
 */
export function buildDayAriaLabel(
  day: MonthlyDaySummary,
  indicators: DayIndicators,
  weekdayLong: string
): string {
  const dayNumber = parseInt(day.date.split('-')[2], 10);
  const parts: string[] = [`Dia ${dayNumber}, ${weekdayLong}`];

  if (indicators.isDataUnavailable) {
    parts.push('Dados indisponíveis');
    return parts.join('. ') + '.';
  }

  if (indicators.isToday) {
    parts.push('Hoje');
  }

  if (indicators.isHoliday && day.holiday) {
    parts.push(`Feriado: ${day.holiday.name}`);
  }

  if (indicators.isVacation) {
    parts.push('Férias cadastradas');
  } else if (indicators.isAbsenceOrLeave && day.occurrence) {
    parts.push(`Ausência/Afastamento: ${day.occurrence.title}`);
  }

  if (indicators.isOpenWorkday) {
    parts.push(`Expediente em andamento (${formatMinutes(day.totalWorkedMinutes)} trabalhados)`);
  } else if (indicators.isCompletedWorkday) {
    parts.push(`Jornada concluída: ${formatMinutes(day.totalWorkedMinutes)} trabalhados`);
  } else if (indicators.isPendingOrIncomplete) {
    parts.push('Jornada incompleta/pendente');
  } else if (indicators.isRestDay) {
    parts.push('Folga semanal');
  } else if (indicators.isFuture) {
    parts.push('Data futura');
  } else {
    parts.push('Sem registros');
  }

  if (indicators.isPositiveBalance && day.balanceMinutes !== null) {
    parts.push(`Saldo positivo: ${formatBalance(day.balanceMinutes)}`);
  } else if (indicators.isNegativeBalance && day.balanceMinutes !== null) {
    parts.push(`Saldo negativo: ${formatBalance(day.balanceMinutes)}`);
  } else if (indicators.isZeroBalance) {
    parts.push('Saldo zerado (00h00)');
  }

  if (indicators.hasManualAdjustment) {
    parts.push('Contém ajuste manual');
  }

  return parts.join('. ') + '.';
}

/**
 * Calculates empty lead-in slots before day 1 for a Monday-first calendar grid.
 * Monday = 0, Tuesday = 1, ..., Sunday = 6.
 */
export function calculateLeadInSlots(firstDateStr: string): number {
  if (!firstDateStr || !firstDateStr.includes('-')) return 0;
  const [y, m, d] = firstDateStr.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  return (dayOfWeek + 6) % 7;
}

/**
 * Builds the complete Smart Calendar Grid Data structure from monthly day summaries.
 * Guarantees exact civil date mapping, prevents day shifting on partial responses,
 * deduplicates entries, and filters out days not matching monthStr.
 */
export function buildSmartCalendarGrid(
  days: MonthlyDaySummary[],
  monthStr: string,
  todayStr: string
): SmartCalendarGridData {
  const [yearStr, monthStrPart] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStrPart, 10);
  const daysInMonth = getDaysInCivilMonth(year, month);

  const firstDateStr = `${monthStr}-01`;
  const leadInSlots = calculateLeadInSlots(firstDateStr);
  const totalSlots = leadInSlots + daysInMonth;
  const leadOutSlots = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);

  // Mapeia e deduplica dias pertencentes estritamente ao mês solicitado
  const dayMap = new Map<string, MonthlyDaySummary>();
  if (Array.isArray(days)) {
    for (const d of days) {
      if (d && typeof d.date === 'string' && d.date.startsWith(`${monthStr}-`)) {
        if (!dayMap.has(d.date)) {
          dayMap.set(d.date, d);
        }
      }
    }
  }

  // Constrói a grade completa garantindo que o dia civil X fique exatamente no slot X
  const smartDays: SmartCalendarDay[] = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = `${monthStr}-${String(dayNum).padStart(2, '0')}`;
    const summary: MonthlyDaySummary = dayMap.get(dateStr) || {
      date: dateStr,
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: null,
      isOpen: false,
      status: 'DATA_UNAVAILABLE',
      entries: [],
    };

    const { short: weekdayShort, long: weekdayLong } = getWeekdayNamesForDate(dateStr);
    const indicators = resolveDayIndicators(summary, todayStr);
    const ariaLabel = buildDayAriaLabel(summary, indicators, weekdayLong);

    smartDays.push({
      summary,
      dayNumber: dayNum,
      weekdayShort,
      weekdayLong,
      indicators,
      ariaLabel,
    });
  }

  return {
    monthStr,
    year,
    month,
    daysInMonth,
    leadInSlots,
    leadOutSlots,
    days: smartDays,
  };
}

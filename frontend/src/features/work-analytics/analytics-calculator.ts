import { MonthlyDaySummary } from '../../types/work-day';
import { BankHoursResponse } from '../../types/bank-hours';
import {
  AnalyticsPeriodPreset,
  AnalyticsDateRange,
  AnalyticsSummaryMetrics,
  MonthlyAggregationItem,
  DailyBalanceDistribution,
  BankHoursEvolutionPoint,
  BankHoursPointStatus,
  WorkAnalyticsData,
  BankHoursAvailabilityStatus,
} from './types';
import { shiftMonth } from '../../utils/date';

/**
 * Returns the number of days in a given year and month (1-based).
 */
export function getDaysInMonth(year: number, month: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (month === 2) return isLeap ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/**
 * Validates that a date string represents a real civil date in YYYY-MM-DD format.
 */
export function isValidCivilDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return false;
  return true;
}

/**
 * Calculates the exact inclusive count of civil days between two dates.
 */
export function getCivilDaysCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate || startDate > endDate) return 0;
  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  const startUtc = Date.UTC(y1, m1 - 1, d1);
  const endUtc = Date.UTC(y2, m2 - 1, d2);
  return Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Generates an end-of-month date string (YYYY-MM-DD) for a given monthStr (YYYY-MM).
 */
export function getMonthEndDay(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const days = getDaysInMonth(year, month);
  return `${monthStr}-${String(days).padStart(2, '0')}`;
}

/**
 * Checks whether a given date range represents whole calendar month(s).
 * A range is whole months if startDate is the 1st of its month and endDate is the last day of its month.
 */
export function isFullMonthRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate || startDate > endDate) return false;
  const partsStart = startDate.split('-');
  if (partsStart.length !== 3) return false;
  const dayStart = parseInt(partsStart[2], 10);
  if (dayStart !== 1) return false;

  const endMonth = endDate.substring(0, 7);
  return endDate === getMonthEndDay(endMonth);
}

/**
 * Calculates start and end dates for quick presets based on today's civil date.
 */
export function getPresetRange(
  preset: AnalyticsPeriodPreset,
  todayStr: string
): AnalyticsDateRange {
  const currentMonthStr = todayStr.substring(0, 7);

  switch (preset) {
    case 'last-3-months': {
      // 3 full months including current: e.g. Sep, Oct, Nov for Nov 2026
      const startMonth = shiftMonth(currentMonthStr, -2);
      return {
        startDate: `${startMonth}-01`,
        endDate: getMonthEndDay(currentMonthStr),
      };
    }
    case 'last-6-months': {
      // 6 full months including current: e.g. Jun to Nov
      const startMonth = shiftMonth(currentMonthStr, -5);
      return {
        startDate: `${startMonth}-01`,
        endDate: getMonthEndDay(currentMonthStr),
      };
    }
    case 'current-month':
    default: {
      return {
        startDate: `${currentMonthStr}-01`,
        endDate: getMonthEndDay(currentMonthStr),
      };
    }
  }
}

/**
 * Returns a sorted array of YYYY-MM months covered by the date range.
 */
export function getMonthsBetween(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return [];
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

  const months: string[] = [];
  let current = startMonth;

  while (current <= endMonth) {
    months.push(current);
    current = shiftMonth(current, 1);
  }

  return months;
}

/**
 * Validates a custom date range. Enforces valid civil dates, startDate <= endDate,
 * and maximum of 12 monthly competences.
 */
export function validateCustomRange(
  startDate: string,
  endDate: string
): { isValid: boolean; error?: string } {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) {
    return { isValid: false, error: 'Data inicial inválida. Utilize o formato AAAA-MM-DD.' };
  }
  if (!dateRegex.test(endDate)) {
    return { isValid: false, error: 'Data final inválida. Utilize o formato AAAA-MM-DD.' };
  }

  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);

  if (m1 < 1 || m1 > 12 || d1 < 1 || d1 > getDaysInMonth(y1, m1)) {
    return { isValid: false, error: 'Data inicial não existe no calendário civil.' };
  }
  if (m2 < 1 || m2 > 12 || d2 < 1 || d2 > getDaysInMonth(y2, m2)) {
    return { isValid: false, error: 'Data final não existe no calendário civil.' };
  }

  if (startDate > endDate) {
    return { isValid: false, error: 'A data final não pode ser anterior à data inicial.' };
  }

  const coveredMonths = getMonthsBetween(startDate, endDate);
  if (coveredMonths.length > 12) {
    return {
      isValid: false,
      error: 'O intervalo selecionado não pode abranger mais de 12 competências mensais.',
    };
  }

  return { isValid: true };
}

/**
 * Filters a flat array of days to strictly keep those within [startDate, endDate].
 */
export function filterDaysByDateRange(
  days: MonthlyDaySummary[],
  startDate: string,
  endDate: string
): MonthlyDaySummary[] {
  return days.filter((d) => d.date >= startDate && d.date <= endDate);
}

/**
 * Formats a YYYY-MM string to a compact label, e.g. "Nov/2026"
 */
export function formatMonthShortLabel(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-');
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const mIndex = parseInt(mStr, 10) - 1;
  const name = monthNames[mIndex] || mStr;
  return `${name}/${yStr}`;
}

/**
 * Calculates summary metrics for the active date range.
 * - totalWorkedMinutes: sum of totalWorkedMinutes (already includes current active session)
 * - totalExpectedMinutes: sum of expectedMinutes up to todayStr (future days do not add to deficit!)
 * - averageWorkedMinutesPerRecordedDay: totalWorkedMinutes / recordedDaysCount (safe division by zero)
 * - officialBankHoursNetMinutes: strictly calculated for full calendar months. For partial ranges,
 *   marked as partial_interval_unavailable without fabricating proportional numbers.
 */
export function calculateSummaryMetrics(
  days: MonthlyDaySummary[],
  range: AnalyticsDateRange,
  todayStr: string,
  bankHours: BankHoursResponse | null,
  rangeMonths: string[],
  failedMonths: string[] = [],
  bankHoursStatus: 'configured' | 'unconfigured' | 'error' = 'unconfigured'
): AnalyticsSummaryMetrics {
  let totalWorked = 0;
  let totalExpected = 0;
  let recordedDays = 0;
  let availableDays = 0;

  for (const day of days) {
    const isFuture = day.date > todayStr || day.status === 'FUTURE';
    const isUnavailable = day.status === 'DATA_UNAVAILABLE';

    if (!isUnavailable) {
      availableDays++;
      totalWorked += day.totalWorkedMinutes || 0;

      const hasEntries = Array.isArray(day.entries) && day.entries.length > 0;
      if (hasEntries || (day.totalWorkedMinutes && day.totalWorkedMinutes > 0)) {
        recordedDays++;
      }

      // Expected hours count only for days up to today (past and today).
      // Future days do not count as planned deficit!
      if (!isFuture) {
        totalExpected += day.expectedMinutes || 0;
      }
    }
  }

  const netDifference = totalWorked - totalExpected;
  const averageWorked = recordedDays > 0 ? Math.round(totalWorked / recordedDays) : 0;

  // Calculate total civil calendar days between startDate and endDate
  const totalDaysInRange = getCivilDaysCount(range.startDate, range.endDate);

  const isPartialCoverage =
    failedMonths.length > 0 ||
    availableDays < totalDaysInRange ||
    days.some((d) => d.status === 'DATA_UNAVAILABLE');

  // Bank of Hours Availability Logic
  let bankHoursNet: number | null = null;
  let availability: BankHoursAvailabilityStatus = 'unconfigured';
  let availabilityReason: string | undefined;

  const isFullMonths = isFullMonthRange(range.startDate, range.endDate);

  if (bankHoursStatus === 'error') {
    availability = 'error';
    availabilityReason = 'Falha ao consultar extrato do Banco de Horas no servidor.';
  } else if (!bankHours?.configured || !bankHours.config) {
    availability = 'unconfigured';
    availabilityReason = 'Banco de Horas não configurado nesta conta.';
  } else if (!isFullMonths) {
    // Custom range selecting only a fraction of a month
    availability = 'partial_interval_unavailable';
    availabilityReason =
      'O extrato oficial do Banco de Horas é apurado exclusivamente por competência mensal inteira. Métrica indisponível para intervalos parciais.';
  } else {
    // Full months and configured: sum official netMinutes for the applicable months
    const startMonth = bankHours.config.startDate.substring(0, 7);
    const applicableMonths = rangeMonths.filter((m) => m >= startMonth);

    if (applicableMonths.length === 0) {
      availability = 'unconfigured';
      availabilityReason = 'O período selecionado é anterior ao início da vigência do Banco de Horas.';
    } else {
      // Check for any missing applicable month (gap in official statement)
      const missingApplicableMonth = applicableMonths.find(
        (m) => !bankHours.monthly.some((bm) => bm.month === m)
      );

      if (missingApplicableMonth) {
        availability = 'statement_incomplete';
        availabilityReason = `Extrato do Banco de Horas incompleto no período (competência ${missingApplicableMonth} ausente).`;
        bankHoursNet = null;
      } else {
        availability = 'configured';
        let sumNet = 0;
        for (const m of applicableMonths) {
          const match = bankHours.monthly.find((bm) => bm.month === m);
          if (match) {
            sumNet += match.netMinutes;
          }
        }
        bankHoursNet = sumNet;
      }
    }
  }

  return {
    totalWorkedMinutes: totalWorked,
    totalExpectedMinutes: totalExpected,
    netDifferenceMinutes: netDifference,
    recordedDaysCount: recordedDays,
    averageWorkedMinutesPerRecordedDay: averageWorked,
    officialBankHoursNetMinutes: bankHoursNet,
    bankHoursAvailability: availability,
    bankHoursAvailabilityReason: availabilityReason,
    isBankHoursConfigured: bankHoursStatus === 'configured',
    isPartialCoverage,
    coverageDaysCount: availableDays,
    totalDaysInRange,
  };
}

/**
 * Calculates distribution of daily balances across 5 clear, mutually exclusive categories:
 * 1. positiveDaysCount (balanceMinutes > 0 on accounted days)
 * 2. negativeDaysCount (balanceMinutes < 0 on accounted days)
 * 3. balancedDaysCount (balanceMinutes === 0 on legitimate accounted workdays/excused days)
 * 4. unaccountedDaysCount (FUTURE, null balance, in progress, or unworked planned rest days)
 * 5. unavailableDaysCount (DATA_UNAVAILABLE or dates within range not received from server)
 *
 * Guaranteed invariant: positive + negative + balanced + unaccounted + unavailable === totalCalendarDays
 */
export function calculateDailyBalanceDistribution(
  days: MonthlyDaySummary[],
  todayStr: string,
  range?: AnalyticsDateRange
): DailyBalanceDistribution {
  let positive = 0;
  let negative = 0;
  let balanced = 0;
  let unaccounted = 0;
  let inProgress = 0;
  let unavailable = 0;

  // Deduplicate and filter by range if range is provided, strictly validating civil date existence
  const uniqueDaysMap = new Map<string, MonthlyDaySummary>();
  for (const day of days) {
    if (!day || typeof day.date !== 'string') continue;
    if (!isValidCivilDate(day.date)) continue;
    if (range) {
      if (day.date < range.startDate || day.date > range.endDate) continue;
    }
    if (!uniqueDaysMap.has(day.date)) {
      uniqueDaysMap.set(day.date, day);
    }
  }

  // Calculate real civil days in the period
  const totalCalendarDays = range
    ? getCivilDaysCount(range.startDate, range.endDate)
    : uniqueDaysMap.size;

  // Identify civil dates in [startDate, endDate] that were not received in the dataset
  if (range) {
    const [y1, m1, d1] = range.startDate.split('-').map(Number);
    const [y2, m2, d2] = range.endDate.split('-').map(Number);
    const iter = new Date(Date.UTC(y1, m1 - 1, d1));
    const end = new Date(Date.UTC(y2, m2 - 1, d2));

    while (iter <= end) {
      const dStr = iter.toISOString().substring(0, 10);
      if (!uniqueDaysMap.has(dStr)) {
        unavailable++;
      }
      iter.setUTCDate(iter.getUTCDate() + 1);
    }
  }

  // Process received unique days
  for (const day of uniqueDaysMap.values()) {
    const isFuture = day.date > todayStr || day.status === 'FUTURE';
    const isUnavailable = day.status === 'DATA_UNAVAILABLE';

    if (isUnavailable) {
      unavailable++;
      continue;
    }

    if (isFuture || day.balanceMinutes === null || day.balanceMinutes === undefined) {
      unaccounted++;
      continue;
    }

    // IN_PROGRESS is provisional open session, not a closed daily balance
    if (day.status === 'IN_PROGRESS' || day.isOpen) {
      unaccounted++;
      inProgress++;
      continue;
    }

    // Unworked rest days are not accounted workdays
    if (day.status === 'REST_DAY' && (day.totalWorkedMinutes || 0) === 0 && (day.expectedMinutes || 0) === 0) {
      unaccounted++;
      continue;
    }

    // NO_RECORDS with 0 expected and 0 worked is an unworked non-working day
    if (day.status === 'NO_RECORDS' && (day.expectedMinutes || 0) === 0 && (day.totalWorkedMinutes || 0) === 0) {
      unaccounted++;
      continue;
    }

    if (day.balanceMinutes > 0) {
      positive++;
    } else if (day.balanceMinutes < 0) {
      negative++;
    } else {
      // balanceMinutes === 0:
      // Only count as balanced if there is legitimate evidence of an accounted day:
      // RECORDED (worked === expected > 0 or adjusted), EXCUSED (abonado), or day with worked/expected > 0
      const hasAccountedEvidence =
        day.status === 'RECORDED' ||
        day.status === 'EXCUSED' ||
        (day.expectedMinutes > 0 && day.totalWorkedMinutes > 0) ||
        Boolean(day.hasManualAdjustments);

      if (hasAccountedEvidence) {
        balanced++;
      } else {
        // e.g. NO_RECORDS with balance 0 and expected 0, or unverified day
        unaccounted++;
      }
    }
  }

  const totalAccounted = positive + negative + balanced;

  return {
    positiveDaysCount: positive,
    negativeDaysCount: negative,
    balancedDaysCount: balanced,
    unaccountedDaysCount: unaccounted,
    unavailableDaysCount: unavailable,
    inProgressDaysCount: inProgress,
    totalAccountedDays: totalAccounted,
    totalCalendarDays,
  };
}

/**
 * Calculates monthly aggregations comparing planned vs worked and merging bank hours stats.
 * Explicitly identifies unavailable months and partial months without fabricating zeros.
 */
export function calculateMonthlyAggregations(
  days: MonthlyDaySummary[],
  rangeMonths: string[],
  todayStr: string,
  bankHours: BankHoursResponse | null,
  failedMonths: string[] = [],
  partialMonths: string[] = [],
  range?: AnalyticsDateRange
): MonthlyAggregationItem[] {
  const currentMonthStr = todayStr.substring(0, 7);
  const isBankConfigured = Boolean(bankHours?.configured && bankHours.config);
  const bankStartMonth = bankHours?.config?.startDate ? bankHours.config.startDate.substring(0, 7) : null;

  // Pre-calculate cumulative closing balance per month if bank hours configured
  // If any intermediate month from startMonth is missing from bankHours.monthly, closing balance cannot be confirmed
  const closingBalanceByMonth = new Map<string, number>();
  if (isBankConfigured && bankHours && bankHours.config) {
    const startMonth = bankHours.config.startDate.substring(0, 7);
    const officialMap = new Map(bankHours.monthly.map((bm) => [bm.month, bm]));
    let runningAcc = bankHours.config.initialBalanceMinutes;
    let chainBroken = false;

    const maxMonth = rangeMonths[rangeMonths.length - 1] || startMonth;
    const monthsChain = getMonthsBetween(startMonth, maxMonth);

    for (const m of monthsChain) {
      const bm = officialMap.get(m);
      if (!bm) {
        chainBroken = true;
      } else {
        if (!chainBroken) {
          runningAcc += bm.netMinutes;
          closingBalanceByMonth.set(m, runningAcc);
        }
      }
    }
  }

  // Group days by month
  const daysByMonth = new Map<string, MonthlyDaySummary[]>();
  for (const m of rangeMonths) {
    daysByMonth.set(m, []);
  }

  for (const day of days) {
    const m = day.date.substring(0, 7);
    const list = daysByMonth.get(m);
    if (list) {
      list.push(day);
    }
  }

  return rangeMonths.map((month) => {
    const isCurrent = month === currentMonthStr;
    const isUnavailable = failedMonths.includes(month);
    const isFraction = range
      ? range.startDate > `${month}-01` || range.endDate < getMonthEndDay(month)
      : false;

    if (isUnavailable) {
      return {
        month,
        monthLabel: formatMonthShortLabel(month),
        status: 'unavailable',
        isCurrentMonth: isCurrent,
        isFractionOfCompetence: isFraction,
        totalWorkedMinutes: null,
        totalExpectedMinutes: null,
        differenceMinutes: null,
        recordedDaysCount: null,
        bankHoursNetMinutes: null,
        bankHoursCumulativeClosingBalance: null,
        isBankHoursActiveInMonth: false,
        hasIncompleteData: true,
        unavailableReason: 'Dados indisponíveis devido a falha na consulta desta competência.',
      };
    }

    const monthDays = daysByMonth.get(month) || [];

    let worked = 0;
    let expected = 0;
    let recordedDays = 0;
    let hasIncomplete = partialMonths.includes(month);

    for (const d of monthDays) {
      const isFuture = d.date > todayStr || d.status === 'FUTURE';
      if (d.status === 'DATA_UNAVAILABLE') {
        hasIncomplete = true;
      } else {
        worked += d.totalWorkedMinutes || 0;
        const hasEntries = Array.isArray(d.entries) && d.entries.length > 0;
        if (hasEntries || (d.totalWorkedMinutes && d.totalWorkedMinutes > 0)) {
          recordedDays++;
        }
        if (!isFuture) {
          expected += d.expectedMinutes || 0;
        }
      }
    }

    const difference = worked - expected;
    const isBankActive = Boolean(isBankConfigured && bankStartMonth && month >= bankStartMonth);
    const bankMatch = bankHours?.monthly.find((bm) => bm.month === month);
    // When the filter only covers a fraction of the competence, official bank netMinutes is omitted (null)
    const bankHoursNet = isFraction ? null : isBankActive && bankMatch ? bankMatch.netMinutes : null;
    const closingBalance = isFraction ? null : isBankActive && closingBalanceByMonth.has(month)
      ? closingBalanceByMonth.get(month)!
      : null;

    const isEmpty = monthDays.length > 0 && worked === 0 && recordedDays === 0;
    const status = hasIncomplete ? 'partial' : isEmpty ? 'empty' : 'available';

    return {
      month,
      monthLabel: formatMonthShortLabel(month),
      status,
      isCurrentMonth: isCurrent,
      isFractionOfCompetence: isFraction,
      totalWorkedMinutes: worked,
      totalExpectedMinutes: expected,
      differenceMinutes: difference,
      recordedDaysCount: recordedDays,
      bankHoursNetMinutes: bankHoursNet,
      bankHoursCumulativeClosingBalance: closingBalance,
      isBankHoursActiveInMonth: isBankActive,
      hasIncompleteData: hasIncomplete,
    };
  });
}

/**
 * Calculates evolution points for the Bank of Hours line chart.
 * Distinguishes closed months, in_progress current month, unconfigured periods, and unavailable months.
 * Never fabricates synthetic zeros or connects across gaps.
 */
export function calculateBankHoursEvolution(
  rangeMonths: string[],
  bankHours: BankHoursResponse | null,
  bankHoursStatus: 'configured' | 'unconfigured' | 'error' = 'unconfigured',
  todayStr: string = ''
): BankHoursEvolutionPoint[] {
  const currentMonthStr = todayStr.substring(0, 7);

  if (bankHoursStatus === 'error') {
    return rangeMonths.map((m) => ({
      month: m,
      monthLabel: formatMonthShortLabel(m),
      status: 'unavailable',
      isConfiguredPeriod: false,
      isCurrentMonth: m === currentMonthStr,
      closingBalanceMinutes: null,
      monthlyNetMinutes: null,
      creditMinutes: null,
      debitMinutes: null,
    }));
  }

  if (!bankHours?.configured || !bankHours.config) {
    return [];
  }

  const startMonth = bankHours.config.startDate.substring(0, 7);
  const officialMap = new Map(bankHours.monthly.map((bm) => [bm.month, bm]));

  // Chronological accumulation starting strictly at startMonth
  // If any intermediate month from startMonth up to m is missing from official statement,
  // cumulative closing balance CANNOT be confirmed (must be null)
  const closingMap = new Map<string, number>();
  let runningAcc = bankHours.config.initialBalanceMinutes;
  let chainBroken = false;

  const maxMonth = rangeMonths[rangeMonths.length - 1] || startMonth;
  const monthsChain = getMonthsBetween(startMonth, maxMonth);

  for (const m of monthsChain) {
    const bm = officialMap.get(m);
    if (!bm) {
      chainBroken = true;
    } else {
      if (!chainBroken) {
        runningAcc += bm.netMinutes;
        closingMap.set(m, runningAcc);
      }
    }
  }

  return rangeMonths.map((m) => {
    const isConfigured = m >= startMonth;
    const isCurrent = m === currentMonthStr;
    const bm = officialMap.get(m);
    const closing = closingMap.get(m) ?? null;

    if (!isConfigured) {
      return {
        month: m,
        monthLabel: formatMonthShortLabel(m),
        status: 'unconfigured',
        isConfiguredPeriod: false,
        isCurrentMonth: isCurrent,
        closingBalanceMinutes: null,
        monthlyNetMinutes: null,
        creditMinutes: null,
        debitMinutes: null,
      };
    }

    if (!bm) {
      return {
        month: m,
        monthLabel: formatMonthShortLabel(m),
        status: 'unavailable',
        isConfiguredPeriod: true,
        isCurrentMonth: isCurrent,
        closingBalanceMinutes: null,
        monthlyNetMinutes: null,
        creditMinutes: null,
        debitMinutes: null,
      };
    }

    const status: BankHoursPointStatus =
      closing === null
        ? 'unconfirmed'
        : isCurrent
        ? 'in_progress'
        : 'closed';

    return {
      month: m,
      monthLabel: formatMonthShortLabel(m),
      status,
      isConfiguredPeriod: true,
      isCurrentMonth: isCurrent,
      closingBalanceMinutes: closing,
      monthlyNetMinutes: bm.netMinutes,
      creditMinutes: bm.creditMinutes,
      debitMinutes: bm.debitMinutes,
    };
  });
}

/**
 * Master aggregate function returning full WorkAnalyticsData model.
 */
export function aggregateWorkAnalytics(
  allDays: MonthlyDaySummary[],
  range: AnalyticsDateRange,
  todayStr: string,
  bankHours: BankHoursResponse | null,
  failedMonths: string[] = [],
  bankHoursStatus: 'configured' | 'unconfigured' | 'error' = 'unconfigured',
  knownPartialMonths: string[] = []
): WorkAnalyticsData {
  const filteredDays = filterDaysByDateRange(allDays, range.startDate, range.endDate);
  const rangeMonths = getMonthsBetween(range.startDate, range.endDate);
  const isCustomPartial = !isFullMonthRange(range.startDate, range.endDate);

  const summaryMetrics = calculateSummaryMetrics(
    filteredDays,
    range,
    todayStr,
    bankHours,
    rangeMonths,
    failedMonths,
    bankHoursStatus
  );
  const dailyBalanceDistribution = calculateDailyBalanceDistribution(filteredDays, todayStr, range);
  const monthlyAggregations = calculateMonthlyAggregations(
    filteredDays,
    rangeMonths,
    todayStr,
    bankHours,
    failedMonths,
    knownPartialMonths,
    range
  );
  const bankHoursEvolution = calculateBankHoursEvolution(
    rangeMonths,
    bankHours,
    bankHoursStatus,
    todayStr
  );

  // Identify months that have partial or incomplete days
  const detectedPartialMonths = Array.from(
    new Set([
      ...knownPartialMonths,
      ...monthlyAggregations.filter((ma) => ma.status === 'partial').map((ma) => ma.month),
    ])
  );

  const bankConfigStartDate = bankHours?.config?.startDate || null;

  return {
    range,
    filteredDays,
    summaryMetrics,
    monthlyAggregations,
    dailyBalanceDistribution,
    bankHoursEvolution,
    partialMonths: detectedPartialMonths,
    failedMonths,
    bankHoursStatus,
    isBankHoursConfigured: bankHoursStatus === 'configured',
    bankHoursConfigStartDate: bankConfigStartDate,
    isCustomPartialMonthRange: isCustomPartial,
  };
}

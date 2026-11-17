import { env } from '../config/env';

/**
 * Formats current date into "Segunda-feira, 21 de setembro" format in pt-BR locale and configured timezone.
 */
export function formatCurrentDate(
  date: Date = new Date(),
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
    // Capitalize first letter of weekday
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (_error) {
    return '';
  }
}

/**
 * Formats time into "08:42:15" with seconds in configured timezone.
 */
export function formatClockTime(
  date: Date = new Date(),
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch (_error) {
    return '00:00:00';
  }
}

/**
 * Returns current month string in YYYY-MM format in target timezone.
 */
export function getCurrentMonthStr(
  date: Date = new Date(),
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    let year = '';
    let month = '';
    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value;
    }
    return `${year}-${month}`;
  } catch (_error) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Formats a YYYY-MM string into "Setembro de 2026".
 */
export function formatMonthLabel(
  monthStr: string,
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, 15));
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      month: 'long',
      year: 'numeric',
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (_error) {
    return monthStr;
  }
}

/**
 * Shifts a YYYY-MM month string by delta (-1 or +1).
 */
export function shiftMonth(monthStr: string, delta: number): string {
  const [yearStr, monthStrPart] = monthStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStrPart, 10) + delta;

  if (month > 12) {
    month = 1;
    year += 1;
  } else if (month < 1) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Formats YYYY-MM-DD into "21 de setembro de 2026".
 */
export function formatFullDate(
  dateStr: string,
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch (_error) {
    return dateStr;
  }
}

/**
 * Formats a Date or ISO timestamp into "DD/MM/YYYY HH:mm" respecting configured target timezone.
 */
export function formatDateTime(
  timestamp: string | Date,
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch (_error) {
    return String(timestamp);
  }
}

/**
 * Returns local YYYY-MM-DD string for today.
 */
export function getTodayDateStr(
  date: Date = new Date(),
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    let year = '';
    let month = '';
    let day = '';
    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
    }
    return `${year}-${month}-${day}`;
  } catch (_error) {
    return '';
  }
}

/**
 * Returns Monday and Sunday date strings for the week containing dateStr.
 */
export function getWeekDateRange(dateStr: string): { mondayStr: string; sundayStr: string } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const civilDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = civilDate.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayUtc = new Date(civilDate.getTime() + diffToMonday * 86400000);
  const sundayUtc = new Date(mondayUtc.getTime() + 6 * 86400000);

  return {
    mondayStr: mondayUtc.toISOString().substring(0, 10),
    sundayStr: sundayUtc.toISOString().substring(0, 10),
  };
}

/**
 * Shifts a Monday date string by deltaWeeks (-1, +1, etc.).
 */
export function shiftWeek(mondayStr: string, deltaWeeks: number): string {
  const [yearStr, monthStr, dayStr] = mondayStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const mondayUtc = new Date(Date.UTC(year, month - 1, day));
  const shifted = new Date(mondayUtc.getTime() + deltaWeeks * 7 * 86400000);
  return shifted.toISOString().substring(0, 10);
}

/**
 * Formats a weekly range label e.g.:
 * "16 a 22 de novembro de 2026"
 * "28 de setembro a 04 de outubro de 2026" (cross-month)
 * "28 de dezembro de 2026 a 03 de janeiro de 2027" (cross-year)
 */
export function formatWeekRangeLabel(mondayStr: string, sundayStr: string): string {
  try {
    const [mY, mM, mD] = mondayStr.split('-').map(Number);
    const [sY, sM, sD] = sundayStr.split('-').map(Number);

    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];

    if (mY !== sY) {
      return `${String(mD).padStart(2, '0')} de ${monthNames[mM - 1]} de ${mY} a ${String(sD).padStart(2, '0')} de ${monthNames[sM - 1]} de ${sY}`;
    }

    if (mM !== sM) {
      return `${String(mD).padStart(2, '0')} de ${monthNames[mM - 1]} a ${String(sD).padStart(2, '0')} de ${monthNames[sM - 1]} de ${sY}`;
    }

    return `${String(mD).padStart(2, '0')} a ${String(sD).padStart(2, '0')} de ${monthNames[sM - 1]} de ${sY}`;
  } catch {
    return `${mondayStr} a ${sundayStr}`;
  }
}

/**
 * Returns the uppercase weekday key ('SUNDAY' | 'MONDAY' | ... | 'SATURDAY')
 * corresponding to a YYYY-MM-DD civil date string, independent of local host timezone.
 */
export function getWeekdayFromCivilDate(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const civilDate = new Date(
    Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10))
  );
  const weekdayKeys = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  return weekdayKeys[civilDate.getUTCDay()];
}

/**
 * Parses a civil date string (YYYY-MM-DD) and minutes from midnight (0..1439)
 * into a UTC Date object representing that exact moment in the target timezone.
 */
export function parseCivilDateTimeToUtc(
  dateStr: string,
  minutesOfDay: number,
  timeZone: string = env.VITE_APP_TIMEZONE
): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const hour = Math.floor(minutesOfDay / 60);
  const min = minutesOfDay % 60;
  const targetUtcMs = Date.UTC(y, m - 1, d, hour, min, 0);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(targetUtcMs));
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value;
  const py = Number(getPart('year'));
  const pm = Number(getPart('month'));
  const pd = Number(getPart('day'));
  let ph = Number(getPart('hour'));
  if (ph === 24) ph = 0;
  const pmin = Number(getPart('minute'));

  const asTzUtcMs = Date.UTC(py, pm - 1, pd, ph, pmin, 0);
  const offsetMs = targetUtcMs - asTzUtcMs;
  return new Date(targetUtcMs + offsetMs);
}

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

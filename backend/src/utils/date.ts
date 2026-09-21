import { Weekday } from '@prisma/client';
import { env } from '../config/env';

/**
 * Formats a Date object to YYYY-MM-DD string in the specified timezone using Intl.DateTimeFormat.
 */
export function getLocalDateString(
  date: Date = new Date(),
  timeZone: string = env.APP_TIMEZONE
): string {
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
}

/**
 * Converts a YYYY-MM-DD string into a Date object at 00:00:00.000 UTC for Prisma @db.Date fields.
 */
export function parseDateToUtcMidnight(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

/**
 * Determines the Prisma Weekday enum for a given date string (YYYY-MM-DD) or Date object.
 */
export function getWeekdayFromDate(
  date: Date | string,
  timeZone: string = env.APP_TIMEZONE
): Weekday {
  const weekdaysByIndex: Weekday[] = [
    Weekday.SUNDAY,
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
    Weekday.SATURDAY,
  ];

  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekdaysByIndex[dayIndex];
  }

  const localDateStr = getLocalDateString(date, timeZone);
  const [year, month, day] = localDateStr.split('-').map(Number);
  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekdaysByIndex[dayIndex];
}

/**
 * Returns the total number of days in a given year and month (1-indexed month).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Returns the date range (start and end UTC midnight Date objects) for a month string YYYY-MM.
 */
export function getMonthDateRange(monthString: string): {
  startDate: Date;
  endDate: Date;
  daysInMonth: number;
  year: number;
  month: number;
} {
  const [yearStr, monthStr] = monthString.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = getDaysInMonth(year, month);

  const startDateStr = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
  const endDateStr = `${yearStr}-${monthStr.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  return {
    startDate: parseDateToUtcMidnight(startDateStr),
    endDate: parseDateToUtcMidnight(endDateStr),
    daysInMonth,
    year,
    month,
  };
}

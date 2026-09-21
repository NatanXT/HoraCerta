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

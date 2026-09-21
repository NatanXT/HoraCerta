import { env } from '../config/env';

/**
 * Formats minutes into "00h00" format (e.g., 480 -> "08h00", 90 -> "01h30").
 */
export function formatMinutes(minutes: number): string {
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const mins = absoluteMinutes % 60;
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMins = String(mins).padStart(2, '0');
  return `${formattedHours}h${formattedMins}`;
}

/**
 * Formats balance minutes into "+00h00" or "-00h00" or "00h00".
 */
export function formatBalance(minutes: number): string {
  const formatted = formatMinutes(minutes);
  if (minutes > 0) {
    return `+${formatted}`;
  }
  if (minutes < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Formats an ISO timestamp string into HH:mm format in the configured timezone.
 */
export function formatTime(
  isoTimestamp: string,
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    const date = new Date(isoTimestamp);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch (_error) {
    return '--:--';
  }
}

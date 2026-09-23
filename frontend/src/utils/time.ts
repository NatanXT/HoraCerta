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

/**
 * Parses a user input string in HH:MM format (with optional + or - sign) into total minutes.
 * Examples: "00:00" -> 0, "02:30" -> 150, "+02:30" -> 150, "-01:15" -> -75.
 * Returns null if format is invalid.
 */
export function parseBalanceInput(inputStr: string): number | null {
  const trimmed = inputStr.trim();
  const match = trimmed.match(/^([+-])?(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);

  return sign * (hours * 60 + minutes);
}

/**
 * Formats signed minutes into HH:MM or +HH:MM / -HH:MM for form input fields.
 * Examples: 150 -> "+02:30", -75 -> "-01:15", 0 -> "00:00".
 */
export function formatBalanceInput(minutes: number): string {
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const mins = absoluteMinutes % 60;
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMins = String(mins).padStart(2, '0');
  const str = `${formattedHours}:${formattedMins}`;

  if (minutes > 0) {
    return `+${str}`;
  }
  if (minutes < 0) {
    return `-${str}`;
  }
  return str;
}

/**
 * Parses a user input string in HH:MM format for day duration (00:00 to 24:00).
 * Examples: "08:00" -> 480, "07:30" -> 450, "00:00" -> 0, "24:00" -> 1440.
 * Returns null if format is invalid or exceeds 1440 minutes.
 */
export function parseDurationInput(inputStr: string): number | null {
  const trimmed = inputStr.trim();
  const match = trimmed.match(/^(\d{2}):([0-5]\d)$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours > 24) return null;
  if (hours === 24 && minutes > 0) return null;

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes < 0 || totalMinutes > 1440) return null;

  return totalMinutes;
}

/**
 * Formats non-negative expected minutes into "HH:MM" for duration form inputs.
 * Examples: 480 -> "08:00", 450 -> "07:30", 0 -> "00:00".
 */
export function formatDurationInput(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(1440, Math.floor(minutes)));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMins = String(mins).padStart(2, '0');
  return `${formattedHours}:${formattedMins}`;
}

/**
 * Normalizes and validates user time input into HH:mm format.
 * 
 * Supports:
 * - '18:24' -> '18:24'
 * - '1824'  -> '18:24'
 * - '824'   -> '08:24'
 * - '8:24'  -> '08:24'
 * - '9'     -> '09:00'
 * - '09'    -> '09:00'
 * 
 * Rejects:
 * - '2460', '1965', '2500', '9999', 'abc', etc. -> returns null
 */
export function normalizeTimeInput(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Case 1: Already contains colon e.g. "18:24" or "8:24"
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return null;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Case 2: Pure digits string e.g. "1824", "824", "9"
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;

  if (digitsOnly.length === 4) {
    // e.g. "1824" -> 18:24
    const h = parseInt(digitsOnly.substring(0, 2), 10);
    const m = parseInt(digitsOnly.substring(2, 4), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }

  if (digitsOnly.length === 3) {
    // e.g. "824" -> 08:24
    const h = parseInt(digitsOnly.substring(0, 1), 10);
    const m = parseInt(digitsOnly.substring(1, 3), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }

  if (digitsOnly.length <= 2) {
    // e.g. "9" -> 09:00, "18" -> 18:00
    const h = parseInt(digitsOnly, 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:00`;
    }
    return null;
  }

  return null;
}

/**
 * Checks if a string is a strictly valid HH:mm time.
 */
export function isValidTimeFormat(val: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(val);
}

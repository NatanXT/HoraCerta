import {
  ReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
  DispatchedReminderRecord,
} from './types';

const SETTINGS_PREFIX = 'horacerta_reminders_settings_v1_';
const DISPATCHED_PREFIX = 'horacerta_reminders_dispatched_v1_';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
    return null;
  } catch {
    return null;
  }
}

export function isLocalStorageAvailable(): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    const testKey = '__hc_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and sanitizes loaded settings, ensuring all fields are valid with safe defaults.
 */
function sanitizeSettings(data: unknown): ReminderSettings {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }

  const obj = data as Partial<ReminderSettings>;
  const validLeadMinutes = [0, 5, 10, 15, 30];
  const validOvertimeMinutes = [30, 60, 90];

  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
    entryEnabled:
      typeof obj.entryEnabled === 'boolean'
        ? obj.entryEnabled
        : DEFAULT_REMINDER_SETTINGS.entryEnabled,
    entryLeadMinutes: validLeadMinutes.includes(obj.entryLeadMinutes as number)
      ? (obj.entryLeadMinutes as number)
      : DEFAULT_REMINDER_SETTINGS.entryLeadMinutes,
    breakEnabled:
      typeof obj.breakEnabled === 'boolean'
        ? obj.breakEnabled
        : DEFAULT_REMINDER_SETTINGS.breakEnabled,
    breakLeadMinutes: validLeadMinutes.includes(obj.breakLeadMinutes as number)
      ? (obj.breakLeadMinutes as number)
      : DEFAULT_REMINDER_SETTINGS.breakLeadMinutes,
    exitEnabled:
      typeof obj.exitEnabled === 'boolean' ? obj.exitEnabled : DEFAULT_REMINDER_SETTINGS.exitEnabled,
    exitLeadMinutes: validLeadMinutes.includes(obj.exitLeadMinutes as number)
      ? (obj.exitLeadMinutes as number)
      : DEFAULT_REMINDER_SETTINGS.exitLeadMinutes,
    overtimeEnabled:
      typeof obj.overtimeEnabled === 'boolean'
        ? obj.overtimeEnabled
        : DEFAULT_REMINDER_SETTINGS.overtimeEnabled,
    overtimeToleranceMinutes: validOvertimeMinutes.includes(obj.overtimeToleranceMinutes as number)
      ? (obj.overtimeToleranceMinutes as number)
      : DEFAULT_REMINDER_SETTINGS.overtimeToleranceMinutes,
    browserNotificationsEnabled:
      typeof obj.browserNotificationsEnabled === 'boolean'
        ? obj.browserNotificationsEnabled
        : DEFAULT_REMINDER_SETTINGS.browserNotificationsEnabled,
  };
}

/**
 * Loads user-scoped reminder settings from local storage.
 */
export function loadReminderSettings(userId: string): ReminderSettings {
  if (!userId || !isLocalStorageAvailable()) {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }

  try {
    const storage = getStorage();
    const raw = storage?.getItem(`${SETTINGS_PREFIX}${userId}`);
    if (!raw) return { ...DEFAULT_REMINDER_SETTINGS };
    const parsed = JSON.parse(raw);
    return sanitizeSettings(parsed);
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

/**
 * Saves user-scoped reminder settings to local storage.
 * Returns true if saved successfully, false if storage unavailable or quota exceeded.
 */
export function saveReminderSettings(userId: string, settings: ReminderSettings): boolean {
  if (!userId || !isLocalStorageAvailable()) return false;

  try {
    const storage = getStorage();
    if (!storage) return false;
    const sanitized = sanitizeSettings(settings);
    storage.setItem(`${SETTINGS_PREFIX}${userId}`, JSON.stringify(sanitized));
    return true;
  } catch (error) {
    // Quota exceeded or storage disabled: gracefully return false
    console.warn('[HoraCerta Reminders] Falha ao persistir preferências no localStorage:', error);
    return false;
  }
}

/**
 * Loads list of dispatched reminder IDs for the user.
 */
export function loadDispatchedReminders(userId: string): DispatchedReminderRecord[] {
  if (!userId || !isLocalStorageAvailable()) return [];

  try {
    const storage = getStorage();
    const raw = storage?.getItem(`${DISPATCHED_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Marks a reminder as dispatched in localStorage to ensure cross-session deduplication.
 * Returns true if persisted successfully, false if localStorage is unavailable or throws.
 */
export function markReminderDispatched(
  userId: string,
  record: DispatchedReminderRecord
): boolean {
  if (!userId || !isLocalStorageAvailable()) return false;

  try {
    const storage = getStorage();
    if (!storage) return false;
    const existing = loadDispatchedReminders(userId);
    // Filter out same ID if already present
    const updated = existing.filter((item) => item.id !== record.id);
    updated.push(record);

    // Limit list size to last 50 entries
    const trimmed = updated.slice(-50);
    storage.setItem(`${DISPATCHED_PREFIX}${userId}`, JSON.stringify(trimmed));
    return true;
  } catch (error) {
    console.warn('[HoraCerta Reminders] Falha ao persistir despacho no localStorage:', error);
    return false;
  }
}

/**
 * Prunes dispatched reminder records older than cutoffDateStr.
 */
export function purgeOldDispatchedReminders(userId: string, keepFromDateStr: string): void {
  if (!userId || !isLocalStorageAvailable()) return;

  try {
    const storage = getStorage();
    const existing = loadDispatchedReminders(userId);
    const filtered = existing.filter((item) => item.dateStr >= keepFromDateStr);
    storage?.setItem(`${DISPATCHED_PREFIX}${userId}`, JSON.stringify(filtered));
  } catch {
    // Safely ignore
  }
}

export type ReminderType = 'ENTRY' | 'BREAK_RETURN' | 'EXIT' | 'OVERTIME';

export type BrowserPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface ReminderSettings {
  enabled: boolean; // Master toggle
  entryEnabled: boolean;
  entryLeadMinutes: number; // 0, 5, 10, 15, 30
  breakEnabled: boolean;
  breakLeadMinutes: number; // 0, 5, 10, 15, 30
  exitEnabled: boolean;
  exitLeadMinutes: number; // 0, 5, 10, 15, 30
  overtimeEnabled: boolean;
  overtimeToleranceMinutes: number; // 30, 60, 90
  browserNotificationsEnabled: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false, // Default is OFF per specification
  entryEnabled: true,
  entryLeadMinutes: 10,
  breakEnabled: true,
  breakLeadMinutes: 5,
  exitEnabled: true,
  exitLeadMinutes: 10,
  overtimeEnabled: false, // Default is OFF per specification
  overtimeToleranceMinutes: 60,
  browserNotificationsEnabled: false,
};

export interface ScheduledReminder {
  id: string; // Unique identifier for deduplication
  type: ReminderType;
  title: string;
  message: string;
  targetTimeFormatted: string; // e.g. "08:00" or "17:50" (horário do evento)
  triggerTimeFormatted: string; // e.g. "07:50" or "17:40" (horário do aviso)
  targetTimeMs: number;
  triggerAtMs: number;
  metadata?: Record<string, unknown>;
}

export interface DispatchedReminderRecord {
  id: string;
  type: ReminderType;
  dispatchedAt: string; // ISO
  dateStr: string;
}

export interface ToastNotification {
  id: string;
  type: ReminderType;
  title: string;
  message: string;
  createdAt: number;
  durationMs?: number;
}


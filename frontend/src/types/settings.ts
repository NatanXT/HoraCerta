export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface SettingsProfile {
  name: string;
  email: string;
}

export interface SettingsPreferences {
  timezone: string;
}

export interface WorkScheduleDay {
  weekday: Weekday;
  expectedMinutes: number;
}

export interface WorkScheduleSettings {
  effectiveFrom: string;
  weeklyExpectedMinutes: number;
  days: WorkScheduleDay[];
}

export interface SettingsResponse {
  profile: SettingsProfile;
  preferences: SettingsPreferences;
  workSchedule: WorkScheduleSettings;
}

export interface SaveProfilePayload {
  name: string;
}

export interface SaveWorkSchedulePayload {
  days: WorkScheduleDay[];
}

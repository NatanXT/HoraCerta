export type TimeEntryType = 'CLOCK_IN' | 'CLOCK_OUT';

export interface TimeEntry {
  id: string;
  type: TimeEntryType;
  timestamp: string;
}

export interface WorkDaySummary {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number;
  isOpen: boolean;
  nextAction: TimeEntryType;
  entries: TimeEntry[];
}

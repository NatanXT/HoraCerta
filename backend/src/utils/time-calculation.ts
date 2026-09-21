import { TimeEntryType } from '@prisma/client';

export interface SimpleTimeEntry {
  id: string;
  type: TimeEntryType;
  timestamp: Date;
}

export interface TimeCalculationInput {
  entries: SimpleTimeEntry[];
  expectedMinutes: number;
  now?: Date;
  isHistorical?: boolean;
}

export interface DaySummaryResult {
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number;
  isOpen: boolean;
  nextAction: TimeEntryType;
}

/**
 * Calculates work day duration metrics, open session time, and balance based on chronological TimeEntry records.
 */
export function calculateDaySummary({
  entries,
  expectedMinutes,
  now = new Date(),
  isHistorical = false,
}: TimeCalculationInput): DaySummaryResult {
  // Sort entries chronologically by timestamp ASC
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalCompletedMs = 0;
  let openClockInTimestamp: number | null = null;

  for (const entry of sortedEntries) {
    const entryTime = new Date(entry.timestamp).getTime();
    if (entry.type === TimeEntryType.CLOCK_IN) {
      openClockInTimestamp = entryTime;
    } else if (entry.type === TimeEntryType.CLOCK_OUT && openClockInTimestamp !== null) {
      const durationMs = Math.max(0, entryTime - openClockInTimestamp);
      totalCompletedMs += durationMs;
      openClockInTimestamp = null;
    }
  }

  // Worked minutes for completed sessions
  const workedMinutes = Math.floor(totalCompletedMs / 60000);

  let isOpen = false;
  let nextAction: TimeEntryType = TimeEntryType.CLOCK_IN;
  let currentSessionMs = 0;
  let currentSessionMinutes = 0;

  if (openClockInTimestamp !== null) {
    isOpen = true;
    nextAction = TimeEntryType.CLOCK_OUT;

    // Accumulate session time only if viewing current day, not a past historical day
    if (!isHistorical) {
      currentSessionMs = Math.max(0, now.getTime() - openClockInTimestamp);
      currentSessionMinutes = Math.floor(currentSessionMs / 60000);
    }
  }

  // Calculate total worked minutes by combining total milliseconds before flooring to prevent precision loss
  const totalWorkedMinutes = Math.floor((totalCompletedMs + currentSessionMs) / 60000);
  const balanceMinutes = totalWorkedMinutes - expectedMinutes;

  return {
    workedMinutes,
    currentSessionMinutes,
    totalWorkedMinutes,
    balanceMinutes,
    isOpen,
    nextAction,
  };
}

import { TimeEntryType } from '@prisma/client';
import { WorkDayWithEntries } from '../repositories/work-day.repository';
import { calculateDaySummary } from './time-calculation';

export type WorkDayStatus =
  | 'FUTURE'
  | 'REST_DAY'
  | 'NO_RECORDS'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'RECORDED';

export interface ResolveWorkDayStateInput {
  dateStr: string;
  todayStr: string;
  defaultExpectedMinutes: number;
  workDay: WorkDayWithEntries | null | undefined;
  now?: Date;
}

export interface ResolvedWorkDayState {
  dateStr: string;
  expectedMinutes: number;
  status: WorkDayStatus;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number | null;
  isOpen: boolean;
  hasEntries: boolean;
}

export function resolveWorkDayState({
  dateStr,
  todayStr,
  defaultExpectedMinutes,
  workDay,
  now = new Date(),
}: ResolveWorkDayStateInput): ResolvedWorkDayState {
  const expectedMinutes = workDay?.expectedMinutesSnapshot ?? defaultExpectedMinutes;
  const hasEntries = !!workDay && workDay.timeEntries.length > 0;
  const isFuture = dateStr > todayStr;
  const isToday = dateStr === todayStr;

  if (isFuture) {
    return {
      dateStr,
      expectedMinutes,
      status: 'FUTURE',
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: null,
      isOpen: false,
      hasEntries: false,
    };
  }

  if (!hasEntries) {
    if (expectedMinutes === 0) {
      return {
        dateStr,
        expectedMinutes: 0,
        status: 'REST_DAY',
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: 0,
        isOpen: false,
        hasEntries: false,
      };
    }

    return {
      dateStr,
      expectedMinutes,
      status: 'NO_RECORDS',
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: null,
      isOpen: false,
      hasEntries: false,
    };
  }

  const calc = calculateDaySummary({
    entries: workDay.timeEntries,
    expectedMinutes,
    now,
    isHistorical: !isToday,
  });

  const lastEntry = workDay.timeEntries[workDay.timeEntries.length - 1];
  let status: WorkDayStatus;

  if (lastEntry.type === TimeEntryType.CLOCK_IN) {
    if (isToday) {
      status = 'IN_PROGRESS';
    } else {
      status = 'INCOMPLETE';
    }
  } else {
    status = 'RECORDED';
  }

  return {
    dateStr,
    expectedMinutes,
    status,
    workedMinutes: calc.workedMinutes,
    currentSessionMinutes: calc.currentSessionMinutes,
    totalWorkedMinutes: calc.totalWorkedMinutes,
    balanceMinutes: calc.balanceMinutes,
    isOpen: calc.isOpen,
    hasEntries: true,
  };
}

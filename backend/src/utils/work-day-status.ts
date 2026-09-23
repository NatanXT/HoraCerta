import { TimeEntryType, CalendarOccurrence } from '@prisma/client';
import { WorkDayWithEntries } from '../repositories/work-day.repository';
import { calculateDaySummary } from './time-calculation';
import { resolveEffectiveExpectedMinutes } from './calendar-occurrence-resolver';

export type WorkDayStatus =
  | 'FUTURE'
  | 'REST_DAY'
  | 'NO_RECORDS'
  | 'IN_PROGRESS'
  | 'INCOMPLETE'
  | 'RECORDED'
  | 'EXCUSED';

export interface ResolveWorkDayStateInput {
  dateStr: string;
  todayStr: string;
  defaultExpectedMinutes: number;
  workDay: WorkDayWithEntries | null | undefined;
  occurrence?: CalendarOccurrence | null;
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
  occurrence: CalendarOccurrence | null;
}

export function resolveWorkDayState({
  dateStr,
  todayStr,
  defaultExpectedMinutes,
  workDay,
  occurrence = null,
  now = new Date(),
}: ResolveWorkDayStateInput): ResolvedWorkDayState {
  const activeOccurrence = occurrence && occurrence.deletedAt === null ? occurrence : null;
  const effectiveExpectedMinutes = resolveEffectiveExpectedMinutes({
    occurrence: activeOccurrence,
    snapshot: workDay?.expectedMinutesSnapshot,
    scheduleExpectedMinutes: defaultExpectedMinutes,
  });

  const activeTimeEntries = workDay
    ? workDay.timeEntries.filter((e) => e.deletedAt === null)
    : [];
  const hasEntries = activeTimeEntries.length > 0;
  const isFuture = dateStr > todayStr;
  const isToday = dateStr === todayStr;

  if (isFuture) {
    return {
      dateStr,
      expectedMinutes: effectiveExpectedMinutes,
      status: 'FUTURE',
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: null,
      isOpen: false,
      hasEntries: false,
      occurrence: activeOccurrence,
    };
  }

  if (!hasEntries) {
    if (activeOccurrence) {
      return {
        dateStr,
        expectedMinutes: 0,
        status: 'EXCUSED',
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: 0,
        isOpen: false,
        hasEntries: false,
        occurrence: activeOccurrence,
      };
    }

    if (effectiveExpectedMinutes === 0) {
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
        occurrence: null,
      };
    }

    return {
      dateStr,
      expectedMinutes: effectiveExpectedMinutes,
      status: 'NO_RECORDS',
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: null,
      isOpen: false,
      hasEntries: false,
      occurrence: null,
    };
  }

  const calc = calculateDaySummary({
    entries: activeTimeEntries,
    expectedMinutes: effectiveExpectedMinutes,
    now,
    isHistorical: !isToday,
  });

  const lastEntry = activeTimeEntries[activeTimeEntries.length - 1];
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
    expectedMinutes: effectiveExpectedMinutes,
    status,
    workedMinutes: calc.workedMinutes,
    currentSessionMinutes: calc.currentSessionMinutes,
    totalWorkedMinutes: calc.totalWorkedMinutes,
    balanceMinutes: calc.balanceMinutes,
    isOpen: calc.isOpen,
    hasEntries: true,
    occurrence: activeOccurrence,
  };
}

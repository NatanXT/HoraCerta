import { CalendarOccurrence, Holiday } from '@prisma/client';

export interface ResolveEffectiveExpectedMinutesInput {
  occurrence?: CalendarOccurrence | null;
  holiday?: Holiday | null;
  snapshot?: number | null;
  scheduleExpectedMinutes?: number | null;
}

/**
  Centralized function to determine effective expected minutes for a day.
  Rule:
  1. Active CalendarOccurrence present -> 0
  2. Holiday present -> 0
  3. Snapshot present (!= null) -> snapshot
  4. WorkSchedule present (!= null) -> scheduleExpectedMinutes
  5. Fallback -> 0
 */
export function resolveEffectiveExpectedMinutes({
  occurrence,
  holiday,
  snapshot,
  scheduleExpectedMinutes,
}: ResolveEffectiveExpectedMinutesInput): number {
  if (occurrence || holiday) {
    return 0;
  }
  if (snapshot !== undefined && snapshot !== null) {
    return snapshot;
  }
  if (scheduleExpectedMinutes !== undefined && scheduleExpectedMinutes !== null) {
    return scheduleExpectedMinutes;
  }
  return 0;
}

export class CalendarOccurrenceResolver {
  private occurrences: CalendarOccurrence[];

  constructor(occurrences: CalendarOccurrence[]) {
    this.occurrences = occurrences.filter((occ) => occ.deletedAt === null);
  }

  getForDate(date: Date | string): CalendarOccurrence | null {
    const targetStr =
      typeof date === 'string'
        ? date
        : date.toISOString().substring(0, 10);

    for (const occ of this.occurrences) {
      const startStr =
        occ.startDate instanceof Date
          ? occ.startDate.toISOString().substring(0, 10)
          : String(occ.startDate).substring(0, 10);
      const endStr =
        occ.endDate instanceof Date
          ? occ.endDate.toISOString().substring(0, 10)
          : String(occ.endDate).substring(0, 10);

      if (startStr <= targetStr && endStr >= targetStr) {
        return occ;
      }
    }

    return null;
  }
}

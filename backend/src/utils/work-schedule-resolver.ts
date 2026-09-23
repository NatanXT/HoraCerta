import { WorkSchedule, Weekday } from '@prisma/client';

export class WorkScheduleResolver {
  private schedules: WorkSchedule[];

  constructor(schedules: WorkSchedule[]) {
    // Sort schedules by effectiveFrom ascending so later versions override earlier versions
    this.schedules = [...schedules].sort(
      (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
    );
  }

  getExpectedMinutesForDate(weekday: Weekday, dateUtcMidnight: Date): number {
    let effectiveMinutes = 0;
    const targetTime = dateUtcMidnight.getTime();

    for (const schedule of this.schedules) {
      if (
        schedule.weekday === weekday &&
        schedule.effectiveFrom.getTime() <= targetTime
      ) {
        effectiveMinutes = schedule.expectedMinutes;
      }
    }

    return effectiveMinutes;
  }
}

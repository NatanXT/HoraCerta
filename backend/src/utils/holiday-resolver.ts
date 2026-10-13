import { Holiday } from '@prisma/client';

export class HolidayResolver {
  private holidaysByDate: Map<string, Holiday> = new Map();

  constructor(holidays: Holiday[]) {
    for (const h of holidays) {
      const dStr =
        h.date instanceof Date
          ? h.date.toISOString().substring(0, 10)
          : String(h.date).substring(0, 10);
      this.holidaysByDate.set(dStr, h);
    }
  }

  getForDate(date: Date | string): Holiday | null {
    const targetStr =
      typeof date === 'string'
        ? date
        : date.toISOString().substring(0, 10);
    return this.holidaysByDate.get(targetStr) ?? null;
  }
}

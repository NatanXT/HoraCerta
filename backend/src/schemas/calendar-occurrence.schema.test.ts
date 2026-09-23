import { describe, it, expect } from 'vitest';
import {
  createCalendarOccurrenceSchema,
  calendarOccurrenceQuerySchema,
} from './calendar-occurrence.schema';
import { CalendarOccurrenceType } from '@prisma/client';

describe('calendarOccurrenceQuerySchema', () => {
  it('should accept valid from and to dates where from <= to', () => {
    const result = calendarOccurrenceQuerySchema.safeParse({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(result.success).toBe(true);
  });

  it('should reject when from > to with error message', () => {
    const result = calendarOccurrenceQuerySchema.safeParse({
      from: '2026-09-30',
      to: '2026-09-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Data inicial (from) não pode ser maior que a data final (to).');
    }
  });

  it('should reject invalid date strings', () => {
    const result = calendarOccurrenceQuerySchema.safeParse({
      from: 'invalid-date',
      to: '2026-09-30',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-existent dates like 2026-02-31', () => {
    const result = calendarOccurrenceQuerySchema.safeParse({
      from: '2026-02-31',
      to: '2026-03-05',
    });
    expect(result.success).toBe(false);
  });
});

describe('createCalendarOccurrenceSchema', () => {
  it('should accept a valid payload', () => {
    const payload = {
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'Feriado Municipal',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
      note: 'Aniversário da cidade',
    };
    const result = createCalendarOccurrenceSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should reject invalid enum type', () => {
    const payload = {
      type: 'INVALID_TYPE',
      title: 'Feriado',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
    };
    const result = createCalendarOccurrenceSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject title shorter than 2 characters', () => {
    const payload = {
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'A',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
    };
    const result = createCalendarOccurrenceSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject title longer than 100 characters', () => {
    const payload = {
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'A'.repeat(101),
      startDate: '2026-10-24',
      endDate: '2026-10-24',
    };
    const result = createCalendarOccurrenceSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject note longer than 500 characters', () => {
    const payload = {
      type: CalendarOccurrenceType.HOLIDAY,
      title: 'Feriado',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
      note: 'X'.repeat(501),
    };
    const result = createCalendarOccurrenceSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject when startDate > endDate', () => {
    const payload = {
      type: CalendarOccurrenceType.VACATION,
      title: 'Férias',
      startDate: '2026-10-20',
      endDate: '2026-10-10',
    };
    const result = createCalendarOccurrenceSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Data inicial não pode ser maior que a data final');
    }
  });
});

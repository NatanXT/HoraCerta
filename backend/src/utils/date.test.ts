import { describe, it, expect } from 'vitest';
import { Weekday } from '@prisma/client';
import {
  getWeekdayFromCivilDate,
  getWeekdayFromInstant,
  getWeekdayFromDate,
  getLocalDateString,
  parseDateToUtcMidnight,
} from './date';

describe('Date Utilities — Civil Date and Weekday Resolution', () => {
  describe('getWeekdayFromCivilDate', () => {
    it('resolves 2026-09-28 to MONDAY regardless of environment', () => {
      const weekday = getWeekdayFromCivilDate('2026-09-28');
      expect(weekday).toBe(Weekday.MONDAY);
    });

    it('resolves 2026-09-27 to SUNDAY regardless of environment', () => {
      const weekday = getWeekdayFromCivilDate('2026-09-27');
      expect(weekday).toBe(Weekday.SUNDAY);
    });

    it('correctly maps all days in a full calendar week', () => {
      expect(getWeekdayFromCivilDate('2026-09-21')).toBe(Weekday.MONDAY);
      expect(getWeekdayFromCivilDate('2026-09-22')).toBe(Weekday.TUESDAY);
      expect(getWeekdayFromCivilDate('2026-09-23')).toBe(Weekday.WEDNESDAY);
      expect(getWeekdayFromCivilDate('2026-09-24')).toBe(Weekday.THURSDAY);
      expect(getWeekdayFromCivilDate('2026-09-25')).toBe(Weekday.FRIDAY);
      expect(getWeekdayFromCivilDate('2026-09-26')).toBe(Weekday.SATURDAY);
      expect(getWeekdayFromCivilDate('2026-09-27')).toBe(Weekday.SUNDAY);
      expect(getWeekdayFromCivilDate('2026-09-28')).toBe(Weekday.MONDAY);
    });
  });

  describe('getWeekdayFromInstant', () => {
    it('resolves true UTC instant 2026-09-28T00:00:00.000Z in UTC to MONDAY', () => {
      const instant = new Date('2026-09-28T00:00:00.000Z');
      const weekday = getWeekdayFromInstant(instant, 'UTC');
      expect(weekday).toBe(Weekday.MONDAY);
    });

    it('resolves 2026-09-28T00:00:00.000Z in America/Sao_Paulo (UTC-3: 2026-09-27 21:00) to SUNDAY', () => {
      const instant = new Date('2026-09-28T00:00:00.000Z');
      const weekday = getWeekdayFromInstant(instant, 'America/Sao_Paulo');
      expect(weekday).toBe(Weekday.SUNDAY);
    });

    it('resolves 2026-09-28T03:00:00.000Z in America/Sao_Paulo (UTC-3: 2026-09-28 00:00) to MONDAY', () => {
      const instant = new Date('2026-09-28T03:00:00.000Z');
      const weekday = getWeekdayFromInstant(instant, 'America/Sao_Paulo');
      expect(weekday).toBe(Weekday.MONDAY);
    });
  });

  describe('getWeekdayFromDate (compatibility wrapper)', () => {
    it('delegates string directly to getWeekdayFromCivilDate', () => {
      expect(getWeekdayFromDate('2026-09-28', 'America/Sao_Paulo')).toBe(Weekday.MONDAY);
      expect(getWeekdayFromDate('2026-09-27', 'America/Sao_Paulo')).toBe(Weekday.SUNDAY);
    });

    it('delegates Date object to getWeekdayFromInstant', () => {
      const instantUtcMidnight = new Date('2026-09-28T00:00:00.000Z');
      expect(getWeekdayFromDate(instantUtcMidnight, 'UTC')).toBe(Weekday.MONDAY);
      expect(getWeekdayFromDate(instantUtcMidnight, 'America/Sao_Paulo')).toBe(Weekday.SUNDAY);
    });
  });

  describe('getLocalDateString', () => {
    it('formats a date to YYYY-MM-DD in UTC', () => {
      const date = new Date('2026-09-28T12:00:00.000Z');
      expect(getLocalDateString(date, 'UTC')).toBe('2026-09-28');
    });

    it('formats a date considering timezone boundaries', () => {
      const date = new Date('2026-09-28T01:00:00.000Z'); // 22:00 on 2026-09-27 in Sao Paulo
      expect(getLocalDateString(date, 'America/Sao_Paulo')).toBe('2026-09-27');
      expect(getLocalDateString(date, 'UTC')).toBe('2026-09-28');
    });
  });

  describe('parseDateToUtcMidnight', () => {
    it('creates exact 00:00:00.000Z Date object for civil date string', () => {
      const date = parseDateToUtcMidnight('2026-09-28');
      expect(date.toISOString()).toBe('2026-09-28T00:00:00.000Z');
    });
  });
});

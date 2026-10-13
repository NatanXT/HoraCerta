import { describe, it, expect } from 'vitest';
import { syncHolidaysSchema, getHolidaysQuerySchema } from './holiday.schema';

describe('Holiday Schema Validation', () => {
  describe('syncHolidaysSchema', () => {
    it('should validate valid year integer', () => {
      const res = syncHolidaysSchema.safeParse({ year: 2026 });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.year).toBe(2026);
      }
    });

    it('should reject year < 1970', () => {
      const res = syncHolidaysSchema.safeParse({ year: 1969 });
      expect(res.success).toBe(false);
    });

    it('should reject year > 2100', () => {
      const res = syncHolidaysSchema.safeParse({ year: 2101 });
      expect(res.success).toBe(false);
    });

    it('should reject non-integer year', () => {
      const res = syncHolidaysSchema.safeParse({ year: 2026.5 });
      expect(res.success).toBe(false);
    });

    it('should reject missing year', () => {
      const res = syncHolidaysSchema.safeParse({});
      expect(res.success).toBe(false);
    });
  });

  describe('getHolidaysQuerySchema', () => {
    it('should coerce string year to number', () => {
      const res = getHolidaysQuerySchema.safeParse({ year: '2026' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.year).toBe(2026);
      }
    });

    it('should reject invalid string', () => {
      const res = getHolidaysQuerySchema.safeParse({ year: 'invalid' });
      expect(res.success).toBe(false);
    });
  });
});

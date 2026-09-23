import { describe, it, expect } from 'vitest';
import { validateReportQuery } from './report.schema';
import { AppError } from '../errors/app-error';

describe('reportQuerySchema & validateReportQuery', () => {
  it('should accept valid date range from <= to', () => {
    const parsed = validateReportQuery({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(parsed).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('should accept exactly 366 inclusive days (2026-01-01 to 2027-01-01)', () => {
    const parsed = validateReportQuery({
      from: '2026-01-01',
      to: '2027-01-01',
    });
    expect(parsed.from).toBe('2026-01-01');
    expect(parsed.to).toBe('2027-01-01');
  });

  it('should reject 367 inclusive days with HTTP 400 and code INVALID_REPORT_PERIOD', () => {
    try {
      validateReportQuery({
        from: '2026-01-01',
        to: '2027-01-02',
      });
      expect.fail('Should have thrown AppError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('INVALID_REPORT_PERIOD');
      expect(err.message).toBe('O período do relatório não pode ultrapassar 366 dias.');
    }
  });

  it('should reject when from > to', () => {
    expect(() =>
      validateReportQuery({
        from: '2026-09-30',
        to: '2026-09-01',
      })
    ).toThrow(AppError);
  });

  it('should reject invalid dates like 2026-02-31', () => {
    expect(() =>
      validateReportQuery({
        from: '2026-02-31',
        to: '2026-03-05',
      })
    ).toThrow(AppError);
  });
});

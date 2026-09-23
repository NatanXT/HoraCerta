import { describe, it, expect } from 'vitest';
import {
  sanitizeCsvCell,
  formatMinutesHuman,
  formatBalanceHuman,
  formatIntervals,
  generateWorkHoursCsv,
} from './csv-serializer';

describe('sanitizeCsvCell & Formula Injection Protection', () => {
  it('should return empty string for null and undefined', () => {
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
    expect(sanitizeCsvCell('')).toBe('');
  });

  it('should neutralize formula injection starting with =, @, \\t, \\r', () => {
    expect(sanitizeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(sanitizeCsvCell('\t=SUM(A1:A2)')).toBe("'\t=SUM(A1:A2)");
    // \r triggers CSV quote wrapping because it is a control carriage return
    expect(sanitizeCsvCell('\r=SUM(A1:A2)')).toBe('"\'\r=SUM(A1:A2)"');
  });

  it('should neutralize dangerous text starting with + or - if not standard duration/number', () => {
    expect(sanitizeCsvCell('+CMD')).toBe("'+CMD");
    expect(sanitizeCsvCell('-CMD')).toBe("'-CMD");
  });

  it('should preserve standard duration and number strings without prepending quote', () => {
    expect(sanitizeCsvCell('+01:30')).toBe('+01:30');
    expect(sanitizeCsvCell('-00:45')).toBe('-00:45');
    expect(sanitizeCsvCell('480')).toBe('480');
    expect(sanitizeCsvCell(-30)).toBe('-30');
  });

  it('should escape double quotes and wrap in quotes if containing delimiter or newline', () => {
    expect(sanitizeCsvCell('Feriado; Municipal')).toBe('"Feriado; Municipal"');
    expect(sanitizeCsvCell('Feriado "Nacional"')).toBe('"Feriado ""Nacional"""');
    expect(sanitizeCsvCell('Linha 1\nLinha 2')).toBe('"Linha 1\nLinha 2"');
  });
});

describe('formatMinutesHuman & formatBalanceHuman', () => {
  it('should format minutes to HH:mm string', () => {
    expect(formatMinutesHuman(480)).toBe('08:00');
    expect(formatMinutesHuman(450)).toBe('07:30');
    expect(formatMinutesHuman(0)).toBe('00:00');
  });

  it('should format balance minutes to +HH:mm or -HH:mm', () => {
    expect(formatBalanceHuman(90)).toBe('+01:30');
    expect(formatBalanceHuman(-45)).toBe('-00:45');
    expect(formatBalanceHuman(0)).toBe('00:00');
    expect(formatBalanceHuman(null)).toBe('');
  });
});

describe('formatIntervals', () => {
  it('should format closed entries into pairs separated by |', () => {
    const entries = [
      { type: 'CLOCK_IN' as const, timestamp: '2026-09-01T08:00:00.000Z' },
      { type: 'CLOCK_OUT' as const, timestamp: '2026-09-01T12:00:00.000Z' },
      { type: 'CLOCK_IN' as const, timestamp: '2026-09-01T13:00:00.000Z' },
      { type: 'CLOCK_OUT' as const, timestamp: '2026-09-01T17:00:00.000Z' },
    ];
    const formatted = formatIntervals(entries, 'UTC');
    expect(formatted).toBe('08:00-12:00 | 13:00-17:00');
  });

  it('should format open entry with "em andamento"', () => {
    const entries = [
      { type: 'CLOCK_IN' as const, timestamp: '2026-09-01T08:00:00.000Z' },
    ];
    const formatted = formatIntervals(entries, 'UTC');
    expect(formatted).toBe('08:00-em andamento');
  });
});

describe('generateWorkHoursCsv', () => {
  it('should generate CSV content starting with BOM and semicolon delimiter', () => {
    const csv = generateWorkHoursCsv({
      period: { from: '2026-09-01', to: '2026-09-30' },
      days: [
        {
          date: '2026-09-01',
          weekday: 'TUESDAY',
          status: 'RECORDED',
          baseExpectedMinutes: 480,
          expectedMinutes: 480,
          workedMinutes: 480,
          balanceMinutes: 0,
          isBankAccounted: true,
          isProvisional: false,
          occurrence: null,
          entrySource: 'CLOCK',
          entries: [],
        },
      ],
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Data;Dia da semana;Status');
    expect(csv).toContain('2026-09-01;Terça-feira;Registrado');
    expect(csv).toContain('08:00;08:00;08:00;00:00;480;480;480;0;;CLOCK;Sim;Não');
  });
});

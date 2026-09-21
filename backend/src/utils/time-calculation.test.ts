import { describe, it, expect } from 'vitest';
import { calculateDaySummary, SimpleTimeEntry } from './time-calculation';
import { TimeEntryType } from '@prisma/client';

describe('calculateDaySummary', () => {
  it('CASO 1: 08:00 IN -> 12:00 OUT (240 minutos)', () => {
    const entries: SimpleTimeEntry[] = [
      { id: '1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z') },
      { id: '2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T12:00:00.000Z') },
    ];

    const result = calculateDaySummary({
      entries,
      expectedMinutes: 480,
      now: new Date('2026-09-21T18:00:00.000Z'),
    });

    expect(result.workedMinutes).toBe(240);
    expect(result.currentSessionMinutes).toBe(0);
    expect(result.totalWorkedMinutes).toBe(240);
    expect(result.balanceMinutes).toBe(-240);
    expect(result.isOpen).toBe(false);
    expect(result.nextAction).toBe(TimeEntryType.CLOCK_IN);
  });

  it('CASO 2: 08:00 IN -> 12:00 OUT -> 13:00 IN -> 17:00 OUT (480 minutos)', () => {
    const entries: SimpleTimeEntry[] = [
      { id: '1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z') },
      { id: '2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T12:00:00.000Z') },
      { id: '3', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T13:00:00.000Z') },
      { id: '4', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T17:00:00.000Z') },
    ];

    const result = calculateDaySummary({
      entries,
      expectedMinutes: 480,
      now: new Date('2026-09-21T18:00:00.000Z'),
    });

    expect(result.workedMinutes).toBe(480);
    expect(result.currentSessionMinutes).toBe(0);
    expect(result.totalWorkedMinutes).toBe(480);
    expect(result.balanceMinutes).toBe(0);
    expect(result.isOpen).toBe(false);
    expect(result.nextAction).toBe(TimeEntryType.CLOCK_IN);
  });

  it('CASO 3: 08:00 IN -> 12:00 OUT -> 13:00 IN (consulta às 14:00)', () => {
    const entries: SimpleTimeEntry[] = [
      { id: '1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z') },
      { id: '2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T12:00:00.000Z') },
      { id: '3', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T13:00:00.000Z') },
    ];

    const result = calculateDaySummary({
      entries,
      expectedMinutes: 480,
      now: new Date('2026-09-21T14:00:00.000Z'),
    });

    expect(result.workedMinutes).toBe(240);
    expect(result.currentSessionMinutes).toBe(60);
    expect(result.totalWorkedMinutes).toBe(300);
    expect(result.balanceMinutes).toBe(-180);
    expect(result.isOpen).toBe(true);
    expect(result.nextAction).toBe(TimeEntryType.CLOCK_OUT);
  });

  it('CASO 4: Sem registros (0 minutos)', () => {
    const entries: SimpleTimeEntry[] = [];

    const result = calculateDaySummary({
      entries,
      expectedMinutes: 480,
      now: new Date('2026-09-21T14:00:00.000Z'),
    });

    expect(result.workedMinutes).toBe(0);
    expect(result.currentSessionMinutes).toBe(0);
    expect(result.totalWorkedMinutes).toBe(0);
    expect(result.balanceMinutes).toBe(-480);
    expect(result.isOpen).toBe(false);
    expect(result.nextAction).toBe(TimeEntryType.CLOCK_IN);
  });

  it('CASO 5: Múltiplos intervalos (08:00 IN -> 10:00 OUT -> 10:15 IN -> 12:00 OUT -> 13:00 IN -> 17:15 OUT = 480m)', () => {
    const entries: SimpleTimeEntry[] = [
      { id: '1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z') },
      { id: '2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T10:00:00.000Z') },
      { id: '3', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T10:15:00.000Z') },
      { id: '4', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T12:00:00.000Z') },
      { id: '5', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T13:00:00.000Z') },
      { id: '6', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T17:15:00.000Z') },
    ];

    const result = calculateDaySummary({
      entries,
      expectedMinutes: 480,
      now: new Date('2026-09-21T18:00:00.000Z'),
    });

    expect(result.workedMinutes).toBe(480);
    expect(result.currentSessionMinutes).toBe(0);
    expect(result.totalWorkedMinutes).toBe(480);
    expect(result.balanceMinutes).toBe(0);
    expect(result.isOpen).toBe(false);
    expect(result.nextAction).toBe(TimeEntryType.CLOCK_IN);
  });

  it('Arredondamento de precisão: 59s concluídos + 59s sessão aberta = 1 minuto total', () => {
    const entries: SimpleTimeEntry[] = [
      { id: '1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z') },
      { id: '2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T08:00:59.000Z') }, // 59s
      { id: '3', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T09:00:00.000Z') }, // open session
    ];

    const result = calculateDaySummary({
      entries,
      expectedMinutes: 480,
      now: new Date('2026-09-21T09:00:59.000Z'), // 59s open session
    });

    expect(result.workedMinutes).toBe(0); // floor(59s) = 0
    expect(result.currentSessionMinutes).toBe(0); // floor(59s) = 0
    expect(result.totalWorkedMinutes).toBe(1); // floor((59s + 59s) / 60s) = floor(118 / 60) = 1
    expect(result.balanceMinutes).toBe(-479);
  });

  it('Dia histórico com sessão não encerrada: não deve acumular minutos até o dia atual', () => {
    const entries: SimpleTimeEntry[] = [
      { id: '1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-20T08:00:00.000Z') },
      { id: '2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-20T12:00:00.000Z') },
      { id: '3', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-20T13:00:00.000Z') }, // Unclosed session from yesterday!
    ];

    const result = calculateDaySummary({
      entries,
      expectedMinutes: 480,
      now: new Date('2026-09-21T15:00:00.000Z'), // Querying today (2026-09-21) for historical date (2026-09-20)
      isHistorical: true,
    });

    expect(result.workedMinutes).toBe(240); // 4h completed session
    expect(result.currentSessionMinutes).toBe(0); // Must be 0 for historical day!
    expect(result.totalWorkedMinutes).toBe(240); // Only completed session count towards total
    expect(result.balanceMinutes).toBe(-240);
    expect(result.isOpen).toBe(true);
    expect(result.nextAction).toBe(TimeEntryType.CLOCK_OUT);
  });
});

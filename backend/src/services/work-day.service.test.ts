import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workDayService } from './work-day.service';
import { userRepository } from '../repositories/user.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { TimeEntryType, Weekday } from '@prisma/client';

describe('WorkDayService - getMonthlySummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    // Freeze clock deterministically at 2026-09-21 12:00:00 UTC
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve calcular corretamente status, saldos e totais descritivos do mês', async () => {
    // Mock user
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    // Mock schedules: Mon-Fri = 480m (8h), Sat-Sun = 0m (Folga)
    vi.spyOn(workScheduleRepository, 'findAllByUser').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Mock WorkDays for 2026-09
    const nowFrozen = new Date('2026-09-21T12:00:00.000Z');

    const mockWorkDays: WorkDayWithEntries[] = [
      {
        id: 'wd-1',
        userId: 'user-1',
        date: new Date('2026-09-01T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-1', workDayId: 'wd-1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-01T08:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-2', workDayId: 'wd-1', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-01T16:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-2',
        userId: 'user-1',
        date: new Date('2026-09-02T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-3', workDayId: 'wd-2', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-02T08:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-4', workDayId: 'wd-2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-02T15:30:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-3',
        userId: 'user-1',
        date: new Date('2026-09-03T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-5', workDayId: 'wd-3', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-03T08:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-21',
        userId: 'user-1',
        date: new Date('2026-09-21T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-6', workDayId: 'wd-21', type: TimeEntryType.CLOCK_IN, timestamp: nowFrozen, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ];

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue(mockWorkDays);

    const result = await workDayService.getMonthlySummary('2026-09');

    expect(result.month).toBe('2026-09');
    expect(result.days.length).toBe(30);

    // A) RECORDED
    const day1 = result.days.find((d) => d.date === '2026-09-01')!;
    expect(day1.status).toBe('RECORDED');
    expect(day1.totalWorkedMinutes).toBe(480);
    expect(day1.balanceMinutes).toBe(0);

    const day2 = result.days.find((d) => d.date === '2026-09-02')!;
    expect(day2.status).toBe('RECORDED');
    expect(day2.totalWorkedMinutes).toBe(450);
    expect(day2.balanceMinutes).toBe(-30);

    // B) INCOMPLETE (Dia histórico com CLOCK_IN aberto)
    const day3 = result.days.find((d) => d.date === '2026-09-03')!;
    expect(day3.status).toBe('INCOMPLETE');
    expect(day3.currentSessionMinutes).toBe(0); // Não deve acumular sessão de ontem até hoje!
    expect(day3.isOpen).toBe(true);

    // C) NO_RECORDS (Dia passado sem registro e com jornada > 0)
    const day4 = result.days.find((d) => d.date === '2026-09-04')!;
    expect(day4.status).toBe('NO_RECORDS');
    expect(day4.balanceMinutes).toBe(null); // NUNCA deve inventar -480m de débito!

    // D) REST_DAY (Dia de folga sem registros)
    const day5 = result.days.find((d) => d.date === '2026-09-05')!;
    expect(day5.status).toBe('REST_DAY');
    expect(day5.balanceMinutes).toBe(0);

    // E) IN_PROGRESS (Hoje em 2026-09-21 com CLOCK_IN aberto no mesmo instante do relógio)
    const day21 = result.days.find((d) => d.date === '2026-09-21')!;
    expect(day21.status).toBe('IN_PROGRESS');
    expect(day21.isOpen).toBe(true);
    expect(day21.currentSessionMinutes).toBe(0);
    expect(day21.balanceMinutes).toBe(-480);

    // F) FUTURE (Dia futuro)
    const day22 = result.days.find((d) => d.date === '2026-09-22')!;
    expect(day22.status).toBe('FUTURE');
    expect(day22.balanceMinutes).toBe(null);

    // G) TOTAL MENSAL & H) Métricas exatas
    expect(result.summary.recordedDays).toBe(4);
    expect(result.summary.incompleteDays).toBe(1);
    expect(result.summary.totalWorkedMinutes).toBe(930);
    expect(result.summary.daysWithoutRecords).toBe(11);
  });
});

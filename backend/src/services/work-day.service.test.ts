import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workDayService } from './work-day.service';
import { userRepository } from '../repositories/user.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { TimeEntryType, TimeEntrySource, Weekday, CalendarOccurrenceType } from '@prisma/client';

describe('WorkDayService - ETAPA 09 (Ausências, Feriados e Status)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve calcular corretamente status, saldos e totais descritivos do mês incluindo EXCUSED', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Active holiday on 2026-09-04
    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
      {
        id: 'occ-1',
        userId: 'user-1',
        type: CalendarOccurrenceType.HOLIDAY,
        title: 'Feriado Municipal',
        startDate: new Date('2026-09-04T00:00:00.000Z'),
        endDate: new Date('2026-09-04T00:00:00.000Z'),
        note: 'Aniversário',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'occ-2',
        userId: 'user-1',
        type: CalendarOccurrenceType.VACATION,
        title: 'Férias Futuras',
        startDate: new Date('2026-09-25T00:00:00.000Z'),
        endDate: new Date('2026-09-30T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

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
          { id: 'te-1', workDayId: 'wd-1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-01T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-2', workDayId: 'wd-1', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-01T16:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ];

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue(mockWorkDays);

    const result = await workDayService.getMonthlySummary('2026-09');

    expect(result.month).toBe('2026-09');
    expect(result.summary.excusedDays).toBe(1);

    // 2026-09-04 should be EXCUSED
    const day4 = result.days.find((d) => d.date === '2026-09-04')!;
    expect(day4.status).toBe('EXCUSED');
    expect(day4.expectedMinutes).toBe(0);
    expect(day4.balanceMinutes).toBe(0);
    expect(day4.occurrence?.title).toBe('Feriado Municipal');

    // 2026-09-25 (future) should maintain status FUTURE and return occurrence VACATION
    const day25 = result.days.find((d) => d.date === '2026-09-25')!;
    expect(day25.status).toBe('FUTURE');
    expect(day25.occurrence?.type).toBe('VACATION');
  });

  it('deve classificar trabalho em feriado como RECORDED gerando crédito integral', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
      id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date()
    });

    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
      {
        id: 'occ-1',
        userId: 'user-1',
        type: CalendarOccurrenceType.HOLIDAY,
        title: 'Feriado',
        startDate: new Date('2026-09-07T00:00:00.000Z'),
        endDate: new Date('2026-09-07T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    vi.spyOn(workDayRepository, 'findByUserAndDate').mockResolvedValue({
      id: 'wd-7',
      userId: 'user-1',
      date: new Date('2026-09-07T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480, // Snapshot preserved as 480
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [
        { id: 'te-1', workDayId: 'wd-7', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-07T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 'te-2', workDayId: 'wd-7', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-07T12:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ],
    });

    const result = await workDayService.getWorkDaySummaryByDateStr('2026-09-07');
    expect(result.expectedMinutes).toBe(0);
    expect(result.totalWorkedMinutes).toBe(240);
    expect(result.balanceMinutes).toBe(240); // 100% credit!
    expect(result.occurrence?.title).toBe('Feriado');
  });

  it('deve classificar ponto sem saída em feriado como INCOMPLETE e não EXCUSED', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
      {
        id: 'occ-1',
        userId: 'user-1',
        type: CalendarOccurrenceType.HOLIDAY,
        title: 'Feriado',
        startDate: new Date('2026-09-07T00:00:00.000Z'),
        endDate: new Date('2026-09-07T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([
      {
        id: 'wd-7',
        userId: 'user-1',
        date: new Date('2026-09-07T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-1', workDayId: 'wd-7', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-07T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ]);

    const result = await workDayService.getMonthlySummary('2026-09');
    const day7 = result.days.find((d) => d.date === '2026-09-07')!;
    expect(day7.status).toBe('INCOMPLETE');
    expect(result.summary.incompleteDays).toBe(1);
    expect(result.summary.excusedDays).toBe(0);
  });
});

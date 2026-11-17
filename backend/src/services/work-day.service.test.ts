import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workDayService } from './work-day.service';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { holidayRepository } from '../repositories/holiday.repository';
import { TimeEntryType, TimeEntrySource, Weekday, CalendarOccurrenceType } from '@prisma/client';
import { prisma } from '../lib/prisma';

describe('WorkDayService - ETAPA 09 & 11 (Ausências, Feriados e Status Autenticado)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(holidayRepository, 'findByDateRange').mockResolvedValue([]);
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
      passwordHash: 'hashed',
      authVersion: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
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

    const mockWorkDays = [
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
        workBreaks: [],
      },
    ];

    vi.spyOn(prisma.workDay, 'findMany').mockResolvedValue(mockWorkDays as any);

    const result = await workDayService.getMonthlySummary('user-1', '2026-09');

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
    vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
      id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date()
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

    vi.spyOn(prisma.workDay, 'findUnique').mockResolvedValue({
      id: 'wd-7',
      userId: 'user-1',
      date: new Date('2026-09-07T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [
        { id: 'te-1', workDayId: 'wd-7', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-07T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 'te-2', workDayId: 'wd-7', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-07T12:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ],
      workBreaks: [],
    } as any);

    const result = await workDayService.getWorkDaySummaryByDateStr('user-1', '2026-09-07');
    expect(result.expectedMinutes).toBe(0);
    expect(result.totalWorkedMinutes).toBe(240);
    expect(result.balanceMinutes).toBe(240); // 100% credit!
    expect(result.occurrence?.title).toBe('Feriado');
  });

  it('deve classificar ponto sem saída em feriado como INCOMPLETE e não EXCUSED', async () => {
    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
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

    vi.spyOn(prisma.workDay, 'findMany').mockResolvedValue([
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
        workBreaks: [],
      },
    ] as any);

    const result = await workDayService.getMonthlySummary('user-1', '2026-09');
    const day7 = result.days.find((d) => d.date === '2026-09-07')!;
    expect(day7.status).toBe('INCOMPLETE');
    expect(result.summary.incompleteDays).toBe(1);
    expect(result.summary.excusedDays).toBe(0);
  });

  it('deve retornar resumo semanal (7 dias de segunda a domingo) sem penalizar dias futuros no saldo', async () => {
    // Current time: 2026-09-23T14:00:00Z (Wednesday)
    vi.setSystemTime(new Date('2026-09-23T14:00:00.000Z'));

    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([]);
    vi.spyOn(holidayRepository, 'findByDateRange').mockResolvedValue([]);

    // Monday (2026-09-21): 8h worked (480 min)
    // Tuesday (2026-09-22): 8h30 worked (510 min)
    // Wednesday (2026-09-23, today): in progress, clocked in at 08:00 (6h in session = 360 min)
    vi.spyOn(prisma.workDay, 'findMany').mockResolvedValue([
      {
        id: 'wd-21',
        userId: 'user-1',
        date: new Date('2026-09-21T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-1', workDayId: 'wd-21', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-2', workDayId: 'wd-21', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T16:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
        workBreaks: [],
      },
      {
        id: 'wd-22',
        userId: 'user-1',
        date: new Date('2026-09-22T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-3', workDayId: 'wd-22', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-22T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-4', workDayId: 'wd-22', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-22T16:30:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
        workBreaks: [],
      },
      {
        id: 'wd-23',
        userId: 'user-1',
        date: new Date('2026-09-23T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-5', workDayId: 'wd-23', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-23T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
        workBreaks: [],
      },
    ] as any);

    // Call for Wednesday date -> should resolve to 2026-09-21 (Monday) to 2026-09-27 (Sunday)
    const result = await workDayService.getWeeklySummary('user-1', '2026-09-23');

    expect(result.summary.startDate).toBe('2026-09-21');
    expect(result.summary.endDate).toBe('2026-09-27');
    expect(result.days).toHaveLength(7);

    // Days 21, 22, 23 have records
    expect(result.summary.recordedDaysCount).toBe(3);
    // Total planned for week = 5 days * 480 = 2400 min (40h)
    expect(result.summary.plannedExpectedMinutes).toBe(2400);

    // Total worked = 480 + 510 + 360 = 1350 min (22h 30min)
    expect(result.summary.totalWorkedMinutes).toBe(1350);

    // Applicable expected = Mon (480) + Tue (480) + Wed (480) = 1440 min
    // Future days (Thu 480, Fri 480) are NOT in applicable expected!
    expect(result.summary.applicableExpectedMinutes).toBe(1440);
    // Weekly balance = 1350 - 1440 = -90 min (-1h 30min), NOT -1050 min!
    expect(result.summary.weeklyBalanceMinutes).toBe(-90);

    expect(result.summary.isCurrentWeek).toBe(true);
    expect(result.summary.isPastWeek).toBe(false);
    expect(result.summary.isFutureWeek).toBe(false);

    expect(result.contextualInsight).toContain('Sua jornada de hoje ainda está em andamento');
  });

  it('deve diferenciar carga nominal de carga efetiva quando houver feriado e ausência abonada', async () => {
    vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z')); // Sexta-feira
    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Feriado na Quarta (2026-09-23)
    vi.spyOn(holidayRepository, 'findByDateRange').mockResolvedValue([
      { id: 'h-1', name: 'Feriado Farroupilha', date: new Date('2026-09-23T00:00:00.000Z'), type: 'NATIONAL', createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    // Ausência abonada na Quinta (2026-09-24)
    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
      {
        id: 'occ-1',
        userId: 'user-1',
        type: CalendarOccurrenceType.VACATION,
        title: 'Folga de Aniversário',
        startDate: new Date('2026-09-24T00:00:00.000Z'),
        endDate: new Date('2026-09-24T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Segunda e Terça trabalhados normalmente
    vi.spyOn(prisma.workDay, 'findMany').mockResolvedValue([
      {
        id: 'wd-21',
        userId: 'user-1',
        date: new Date('2026-09-21T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-1', workDayId: 'wd-21', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-2', workDayId: 'wd-21', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T16:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
        workBreaks: [],
      },
      {
        id: 'wd-22',
        userId: 'user-1',
        date: new Date('2026-09-22T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-3', workDayId: 'wd-22', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-22T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-4', workDayId: 'wd-22', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-22T16:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
        workBreaks: [],
      },
    ] as any);

    const result = await workDayService.getWeeklySummary('user-1', '2026-09-21');

    // Carga nominal do perfil: 5 dias úteis * 480 min = 2400 min (40h)
    expect(result.summary.nominalExpectedMinutes).toBe(2400);

    // Carga efetiva planejada: deduz quarta (feriado = 0) e quinta (ausência = 0) -> 3 dias * 480 = 1440 min (24h)
    expect(result.summary.plannedExpectedMinutes).toBe(1440);

    // Dias planejados efetivos = 3 dias
    expect(result.summary.plannedDaysCount).toBe(3);

    // Quarta deve ser classificada como Feriado
    const wednesday = result.days.find((d) => d.date === '2026-09-23')!;
    expect(wednesday.statusLabel).toBe('Feriado');
    expect(wednesday.expectedMinutes).toBe(0);

    // Quinta deve ser classificada como Ausência abonada
    const thursday = result.days.find((d) => d.date === '2026-09-24')!;
    expect(thursday.statusLabel).toBe('Ausência abonada');
    expect(thursday.expectedMinutes).toBe(0);
  });

  it('deve contabilizar trabalho em dia de folga e snapshot customizado de carga horária', async () => {
    vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z')); // Domingo (semana já decorrida)
    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    vi.spyOn(holidayRepository, 'findByDateRange').mockResolvedValue([]);
    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([]);

    // Sábado com trabalho extraordinário de 4h (240 min)
    // Segunda com expectedMinutesSnapshot reduzido para 360 min (6h)
    vi.spyOn(prisma.workDay, 'findMany').mockResolvedValue([
      {
        id: 'wd-21',
        userId: 'user-1',
        date: new Date('2026-09-21T00:00:00.000Z'),
        note: 'Jornada reduzida acordada',
        expectedMinutesSnapshot: 360,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-1', workDayId: 'wd-21', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-2', workDayId: 'wd-21', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T14:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
        workBreaks: [],
      },
      {
        id: 'wd-26',
        userId: 'user-1',
        date: new Date('2026-09-26T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-3', workDayId: 'wd-26', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-26T08:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-4', workDayId: 'wd-26', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-26T12:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
        workBreaks: [],
      },
    ] as any);

    const result = await workDayService.getWeeklySummary('user-1', '2026-09-21');

    const monday = result.days.find((d) => d.date === '2026-09-21')!;
    expect(monday.expectedMinutes).toBe(360); // Respeita snapshot
    expect(monday.totalWorkedMinutes).toBe(360);
    expect(monday.balanceMinutes).toBe(0);

    const saturday = result.days.find((d) => d.date === '2026-09-26')!;
    expect(saturday.expectedMinutes).toBe(0);
    expect(saturday.totalWorkedMinutes).toBe(240);
    expect(saturday.balanceMinutes).toBe(240); // 100% de crédito por trabalhar em folga!
  });
});

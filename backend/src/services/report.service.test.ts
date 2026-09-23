import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportService } from './report.service';
import { userRepository } from '../repositories/user.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { bankHoursConfigRepository } from '../repositories/bank-hours-config.repository';
import { TimeEntryType, TimeEntrySource, Weekday, CalendarOccurrenceType } from '@prisma/client';

describe('ReportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve calcular corretamente pendingDays, baseExpectedMinutes, status e breakdown de ocorrências', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
      id: 'cfg-1',
      userId: 'user-1',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      initialBalanceMinutes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
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

    // CalendarOccurrences:
    // 1) Spanning boundary: 28/08 to 03/09 (inside period 01/09-30/09 -> 3 days: 01, 02, 03)
    // 2) Future vacation: 25/09 to 30/09 (6 days)
    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
      {
        id: 'occ-1',
        userId: 'user-1',
        type: CalendarOccurrenceType.HOLIDAY,
        title: 'Feriado Prolongado',
        startDate: new Date('2026-08-28T00:00:00.000Z'),
        endDate: new Date('2026-09-03T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'occ-2',
        userId: 'user-1',
        type: CalendarOccurrenceType.VACATION,
        title: 'Férias Regulamentares',
        startDate: new Date('2026-09-25T00:00:00.000Z'),
        endDate: new Date('2026-09-30T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // WorkDays
    const mockWorkDays: WorkDayWithEntries[] = [
      {
        id: 'wd-4',
        userId: 'user-1',
        date: new Date('2026-09-04T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-1', workDayId: 'wd-4', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-04T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ];

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue(mockWorkDays);

    const report = await reportService.getWorkHoursReport('2026-09-01', '2026-09-30');

    expect(report.summary.calendarDays).toBe(30);
    expect(report.summary.incompleteDays).toBe(1); // 04/09 incomplete
    expect(report.summary.pendingDays).toBe(report.summary.noRecordsDays + report.summary.incompleteDays);

    // Occurrence breakdown intersection:
    // HOLIDAY (28/08-03/09 in 01/09-30/09) -> 3 days (01, 02, 03)
    // VACATION (25/09-30/09 in 01/09-30/09) -> 6 days
    expect(report.occurrences.totalOccurrenceDays).toBe(9);
    const holidayStat = report.occurrences.byType.find((t) => t.type === 'HOLIDAY');
    expect(holidayStat?.days).toBe(3);
    const vacationStat = report.occurrences.byType.find((t) => t.type === 'VACATION');
    expect(vacationStat?.days).toBe(6);

    // Base vs Effective expected on 2026-09-01 (holiday)
    const day1 = report.days.find((d) => d.date === '2026-09-01')!;
    expect(day1.baseExpectedMinutes).toBe(480);
    expect(day1.expectedMinutes).toBe(0);
    expect(day1.status).toBe('EXCUSED');
  });

  it('deve manter o dia de HOJE fechado como provisório fora do saldo acumulado consolidado', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
      id: 'cfg-1',
      userId: 'user-1',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      initialBalanceMinutes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([]);

    // 2026-09-21 é HOJE (frozen clock em 2026-09-21 12:00:00).
    // Suponha que o usuário trabalhou 510m (08:00 às 16:30) e fechou o ponto hoje.
    const mockWorkDays: WorkDayWithEntries[] = [
      {
        id: 'wd-21',
        userId: 'user-1',
        date: new Date('2026-09-21T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-1', workDayId: 'wd-21', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-2', workDayId: 'wd-21', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-21T16:30:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ];

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue(mockWorkDays);

    const report = await reportService.getWorkHoursReport('2026-09-01', '2026-09-21');

    // O dia de hoje NÃO entra no consolidado do período (periodConsolidatedBalanceMinutes = 0)
    expect(report.bankHours.periodConsolidatedBalanceMinutes).toBe(0);
    // Mas entra no saldo provisório de hoje (+30m)
    expect(report.bankHours.provisionalTodayBalanceMinutes).toBe(30);
    // E no live balance (+30m)
    expect(report.bankHours.livePeriodBalanceMinutes).toBe(30);
    expect(report.period.hasProvisionalData).toBe(true);
  });

  it('deve derivar entrySource ignorando registros com soft delete', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue(null);
    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([]);
    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([]);

    // WorkDay com entrada MANUAL excluída e entrada CLOCK ativa
    const mockWorkDays: WorkDayWithEntries[] = [
      {
        id: 'wd-1',
        userId: 'user-1',
        date: new Date('2026-09-01T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-deleted', workDayId: 'wd-1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-01T07:50:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: new Date('2026-09-01T10:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-active', workDayId: 'wd-1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-01T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-active-2', workDayId: 'wd-1', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-01T16:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ];

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue(mockWorkDays);

    const report = await reportService.getWorkHoursReport('2026-09-01', '2026-09-01');

    const day1 = report.days[0];
    expect(day1.entries.length).toBe(2); // Apenas as 2 entradas ativas
    expect(day1.entrySource).toBe('CLOCK'); // Ignorou a entrada MANUAL excluída!
  });
});

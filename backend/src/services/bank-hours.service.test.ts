import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bankHoursService } from './bank-hours.service';
import { workDayRepository } from '../repositories/work-day.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { bankHoursConfigRepository } from '../repositories/bank-hours-config.repository';
import { calendarOccurrenceRepository } from '../repositories/calendar-occurrence.repository';
import { saveBankHoursConfigSchema } from '../schemas/bank-hours.schema';
import { Weekday, CalendarOccurrenceType } from '@prisma/client';

describe('saveBankHoursConfigSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve aceitar datas válidas do passado ou hoje e minutos inteiros', () => {
    expect(saveBankHoursConfigSchema.safeParse({ startDate: '2026-09-01', initialBalanceMinutes: 120 }).success).toBe(true);
    expect(saveBankHoursConfigSchema.safeParse({ startDate: '2026-09-21', initialBalanceMinutes: -90 }).success).toBe(true);
    expect(saveBankHoursConfigSchema.safeParse({ startDate: '2026-09-21', initialBalanceMinutes: 0 }).success).toBe(true);
  });

  it('deve rejeitar datas futuras com a mensagem correta', () => {
    const res = saveBankHoursConfigSchema.safeParse({ startDate: '2026-09-22', initialBalanceMinutes: 0 });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('A data inicial da apuração não pode ser futura.');
    }
  });

  it('deve rejeitar datas inexistentes ou formatos incorretos com mensagem de data inválida', () => {
    const resInexistente = saveBankHoursConfigSchema.safeParse({ startDate: '2026-02-31', initialBalanceMinutes: 0 });
    expect(resInexistente.success).toBe(false);
    if (!resInexistente.success) {
      expect(resInexistente.error.issues[0].message).toBe('Data inicial inválida. Utilize uma data real no formato YYYY-MM-DD.');
    }

    const resFormato = saveBankHoursConfigSchema.safeParse({ startDate: '21/09/2026', initialBalanceMinutes: 0 });
    expect(resFormato.success).toBe(false);
    if (!resFormato.success) {
      expect(resFormato.error.issues[0].message).toBe('Data inicial inválida. Utilize uma data real no formato YYYY-MM-DD.');
    }
  });

  it('deve rejeitar números decimais como minutos', () => {
    expect(saveBankHoursConfigSchema.safeParse({ startDate: '2026-09-01', initialBalanceMinutes: 1.5 }).success).toBe(false);
  });
});

describe('BankHoursService - getBankHoursStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve retornar configured: false quando não existir configuração do usuário', async () => {
    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue(null);
    vi.spyOn(workDayRepository, 'findOldestByUser').mockResolvedValue(null);

    const status = await bankHoursService.getBankHoursStatus('user-1');

    expect(status.configured).toBe(false);
    expect(status.suggestedStartDate).toBe('2026-09-21');
    expect(status.summary).toBeNull();
  });

  it('deve excluir dias EXCUSED das pendências e considerar trabalho em feriado como crédito', async () => {
    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
      id: 'cfg-1',
      userId: 'user-1',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      initialBalanceMinutes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
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

    // Active holiday on 2026-09-03
    vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
      {
        id: 'occ-1',
        userId: 'user-1',
        type: CalendarOccurrenceType.HOLIDAY,
        title: 'Feriado',
        startDate: new Date('2026-09-03T00:00:00.000Z'),
        endDate: new Date('2026-09-03T00:00:00.000Z'),
        note: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

    const res = await bankHoursService.getBankHoursStatus('user-1');

    // 2026-09-03 (Quinta) era dia útil, mas está coberto pelo Feriado -> EXCUSED
    // Não deve constar na lista de pendências!
    const pending03 = res.pending.find((p) => p.date === '2026-09-03');
    expect(pending03).toBeUndefined();
  });

  describe('BANK_HOURS_LEAVE — Casos de Teste do Banco de Horas (Parte G)', () => {
    const mockSchedule = [
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, plannedStartMinutes: 480, plannedEndMinutes: 1035, snackBreakMinutes: 15, lunchBreakMinutes: 60, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, plannedStartMinutes: null, plannedEndMinutes: null, snackBreakMinutes: 0, lunchBreakMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ];

    it('Caso 1: base = 480, BANK_HOURS_LEAVE, worked = 0 -> saldo impacta em -480 (débito)', async () => {
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        initialBalanceMinutes: 600,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
        {
          id: 'occ-bh',
          userId: 'user-1',
          type: CalendarOccurrenceType.BANK_HOURS_LEAVE,
          title: 'Folga BH',
          startDate: new Date('2026-09-08T00:00:00.000Z'),
          endDate: new Date('2026-09-08T00:00:00.000Z'),
          note: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      expect(res.summary?.debitMinutes).toBe(480);
      expect(res.summary?.creditMinutes).toBe(0);
      expect(res.summary?.consolidatedBalanceMinutes).toBe(120); // 600 - 480
    });

    it('Caso 2: base = 480, BANK_HOURS_LEAVE, worked = 240 -> saldo impacta em -240', async () => {
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-08T00:00:00.000Z'),
        initialBalanceMinutes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
        {
          id: 'occ-bh',
          userId: 'user-1',
          type: CalendarOccurrenceType.BANK_HOURS_LEAVE,
          title: 'Folga BH parcial',
          startDate: new Date('2026-09-08T00:00:00.000Z'),
          endDate: new Date('2026-09-08T00:00:00.000Z'),
          note: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      // Trabalhou das 08:00 às 12:00 (240 min)
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([
        {
          id: 'wd-1',
          userId: 'user-1',
          date: new Date('2026-09-08T00:00:00.000Z'),
          expectedMinutesSnapshot: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          timeEntries: [
            { id: 't1', workDayId: 'wd-1', type: 'CLOCK_IN', timestamp: new Date('2026-09-08T08:00:00.000Z'), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
            { id: 't2', workDayId: 'wd-1', type: 'CLOCK_OUT', timestamp: new Date('2026-09-08T12:00:00.000Z'), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          ],
        },
      ]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      expect(res.summary?.debitMinutes).toBe(240);
      expect(res.summary?.consolidatedBalanceMinutes).toBe(-240); // 0 - 240 = -240
    });

    it('Caso 3: base = 480, BANK_HOURS_LEAVE, worked = 480 -> saldo impacta em 0', async () => {
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-08T00:00:00.000Z'),
        initialBalanceMinutes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
        {
          id: 'occ-bh',
          userId: 'user-1',
          type: CalendarOccurrenceType.BANK_HOURS_LEAVE,
          title: 'Folga BH',
          startDate: new Date('2026-09-08T00:00:00.000Z'),
          endDate: new Date('2026-09-08T00:00:00.000Z'),
          note: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([
        {
          id: 'wd-1',
          userId: 'user-1',
          date: new Date('2026-09-08T00:00:00.000Z'),
          expectedMinutesSnapshot: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          timeEntries: [
            { id: 't1', workDayId: 'wd-1', type: 'CLOCK_IN', timestamp: new Date('2026-09-08T08:00:00.000Z'), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
            { id: 't2', workDayId: 'wd-1', type: 'CLOCK_OUT', timestamp: new Date('2026-09-08T16:00:00.000Z'), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          ],
        },
      ]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      expect(res.summary?.debitMinutes).toBe(0);
      expect(res.summary?.creditMinutes).toBe(0);
      expect(res.summary?.consolidatedBalanceMinutes).toBe(0);
    });

    it('Caso 4: base = 480, BANK_HOURS_LEAVE, worked = 540 -> saldo impacta em +60', async () => {
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-08T00:00:00.000Z'),
        initialBalanceMinutes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
        {
          id: 'occ-bh',
          userId: 'user-1',
          type: CalendarOccurrenceType.BANK_HOURS_LEAVE,
          title: 'Folga BH',
          startDate: new Date('2026-09-08T00:00:00.000Z'),
          endDate: new Date('2026-09-08T00:00:00.000Z'),
          note: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([
        {
          id: 'wd-1',
          userId: 'user-1',
          date: new Date('2026-09-08T00:00:00.000Z'),
          expectedMinutesSnapshot: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          timeEntries: [
            { id: 't1', workDayId: 'wd-1', type: 'CLOCK_IN', timestamp: new Date('2026-09-08T08:00:00.000Z'), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
            { id: 't2', workDayId: 'wd-1', type: 'CLOCK_OUT', timestamp: new Date('2026-09-08T17:00:00.000Z'), source: 'CLOCK', deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          ],
        },
      ]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      expect(res.summary?.creditMinutes).toBe(60);
      expect(res.summary?.debitMinutes).toBe(0);
      expect(res.summary?.consolidatedBalanceMinutes).toBe(60);
    });

    it('Caso 5: normal NO_RECORDS -> saldo é null e NÃO entra no saldo consolidado como -480', async () => {
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-08T00:00:00.000Z'),
        initialBalanceMinutes: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([]);
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      // 2026-09-08 sem ocorrência e sem pontos vira pendência (NO_RECORDS), não debita 480
      expect(res.pending.length).toBeGreaterThan(0);
      expect(res.summary?.consolidatedBalanceMinutes).toBe(100);
    });

    it('Caso 6: JUSTIFIED_ABSENCE -> não debita banco (saldo 0, não -480)', async () => {
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-08T00:00:00.000Z'),
        initialBalanceMinutes: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
        {
          id: 'occ-ja',
          userId: 'user-1',
          type: CalendarOccurrenceType.JUSTIFIED_ABSENCE,
          title: 'Ausência justificada',
          startDate: new Date('2026-09-08T00:00:00.000Z'),
          endDate: new Date('2026-09-08T00:00:00.000Z'),
          note: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      expect(res.summary?.creditMinutes).toBe(0);
      expect(res.summary?.debitMinutes).toBe(0);
      expect(res.summary?.consolidatedBalanceMinutes).toBe(100); // Intacto
    });

    it('Caso 7: BANK_HOURS_LEAVE future -> não entra no saldo consolidado', async () => {
      // Hoje é 2026-09-21. Folga em 2026-09-25 (futuro)
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-21T00:00:00.000Z'),
        initialBalanceMinutes: 500,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
        {
          id: 'occ-future',
          userId: 'user-1',
          type: CalendarOccurrenceType.BANK_HOURS_LEAVE,
          title: 'Folga futura',
          startDate: new Date('2026-09-25T00:00:00.000Z'),
          endDate: new Date('2026-09-25T00:00:00.000Z'),
          note: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      expect(res.summary?.consolidatedBalanceMinutes).toBe(500); // 25/09 ainda é futuro, consolidado intacto
    });

    it('Caso 8: range cobrindo fim de semana (sexta a segunda) -> débito somente em dias com baseExpectedMinutes > 0', async () => {
      vi.setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
      // Período: 2026-09-18 (sexta) a 2026-09-21 (segunda)
      // Sexta (480) -> -480
      // Sábado (0) -> 0
      // Domingo (0) -> 0
      // Segunda (480) -> -480
      // Total débito: -960 min (-16h)
      vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
        id: 'cfg-1',
        userId: 'user-1',
        startDate: new Date('2026-09-18T00:00:00.000Z'),
        initialBalanceMinutes: 1200,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(mockSchedule);
      vi.spyOn(calendarOccurrenceRepository, 'findActiveInRange').mockResolvedValue([
        {
          id: 'occ-range',
          userId: 'user-1',
          type: CalendarOccurrenceType.BANK_HOURS_LEAVE,
          title: 'Folga prolongada BH',
          startDate: new Date('2026-09-18T00:00:00.000Z'),
          endDate: new Date('2026-09-21T00:00:00.000Z'),
          note: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

      const res = await bankHoursService.getBankHoursStatus('user-1');
      expect(res.summary?.debitMinutes).toBe(960);
      expect(res.summary?.consolidatedBalanceMinutes).toBe(240); // 1200 - 960 = 240
    });
  });
});

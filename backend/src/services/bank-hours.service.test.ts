import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bankHoursService } from './bank-hours.service';
import { userRepository } from '../repositories/user.repository';
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
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue(null);
    vi.spyOn(workDayRepository, 'findOldestByUser').mockResolvedValue(null);

    const status = await bankHoursService.getBankHoursStatus();

    expect(status.configured).toBe(false);
    expect(status.suggestedStartDate).toBe('2026-09-21');
    expect(status.summary).toBeNull();
  });

  it('deve excluir dias EXCUSED das pendências e considerar trabalho em feriado como crédito', async () => {
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

    const res = await bankHoursService.getBankHoursStatus();

    // 2026-09-03 (Quinta) era dia útil, mas está coberto pelo Feriado -> EXCUSED
    // Não deve constar na lista de pendências!
    const pending03 = res.pending.find((p) => p.date === '2026-09-03');
    expect(pending03).toBeUndefined();
  });
});

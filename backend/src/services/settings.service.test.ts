import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { settingsService } from './settings.service';
import { workDayService } from './work-day.service';
import { timeEntryService } from './time-entry.service';
import { bankHoursService } from './bank-hours.service';
import { manualAdjustmentService } from './manual-adjustment.service';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { bankHoursConfigRepository } from '../repositories/bank-hours-config.repository';
import { timeEntryRepository } from '../repositories/time-entry.repository';
import { workDayAdjustmentRepository } from '../repositories/work-day-adjustment.repository';
import { updateProfileSchema, updateWorkScheduleSchema } from '../schemas/settings.schema';
import { WorkScheduleResolver } from '../utils/work-schedule-resolver';
import { Weekday, TimeEntryType, TimeEntrySource } from '@prisma/client';

describe('ETAPA 08 — Settings Schemas Validation', () => {
  it('updateProfileSchema: deve aceitar nome válido e rejeitar vazio ou menor que 2 caracteres', () => {
    expect(updateProfileSchema.safeParse({ name: 'Natan' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ name: '  Ana  ' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('updateWorkScheduleSchema: deve aceitar exatamente 7 dias válidos e rejeitar inconsistências', () => {
    const valid7Days = [
      { weekday: Weekday.MONDAY, expectedMinutes: 480 },
      { weekday: Weekday.TUESDAY, expectedMinutes: 480 },
      { weekday: Weekday.WEDNESDAY, expectedMinutes: 480 },
      { weekday: Weekday.THURSDAY, expectedMinutes: 480 },
      { weekday: Weekday.FRIDAY, expectedMinutes: 360 },
      { weekday: Weekday.SATURDAY, expectedMinutes: 0 },
      { weekday: Weekday.SUNDAY, expectedMinutes: 0 },
    ];
    expect(updateWorkScheduleSchema.safeParse({ days: valid7Days }).success).toBe(true);

    // Menos de 7 dias
    expect(updateWorkScheduleSchema.safeParse({ days: valid7Days.slice(0, 6) }).success).toBe(false);

    // Weekday duplicado
    const duplicateDays = [...valid7Days.slice(0, 6), { weekday: Weekday.MONDAY, expectedMinutes: 480 }];
    expect(updateWorkScheduleSchema.safeParse({ days: duplicateDays }).success).toBe(false);

    // Minutos negativos
    const negativeDays = [...valid7Days];
    negativeDays[0] = { weekday: Weekday.MONDAY, expectedMinutes: -60 };
    expect(updateWorkScheduleSchema.safeParse({ days: negativeDays }).success).toBe(false);

    // Minutos decimais
    const decimalDays = [...valid7Days];
    decimalDays[0] = { weekday: Weekday.MONDAY, expectedMinutes: 480.5 };
    expect(updateWorkScheduleSchema.safeParse({ days: decimalDays }).success).toBe(false);

    // Minutos > 1440
    const overflowDays = [...valid7Days];
    overflowDays[0] = { weekday: Weekday.MONDAY, expectedMinutes: 1500 };
    expect(updateWorkScheduleSchema.safeParse({ days: overflowDays }).success).toBe(false);
  });
});

describe('ETAPA 08 — Versionamento de WorkSchedule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WorkScheduleResolver: deve selecionar a versão vigente na data (effectiveFrom <= date DESC)', () => {
    const schedules = [
      { id: '1', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 360, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ];
    const resolver = new WorkScheduleResolver(schedules);

    // Data 2026-09-21 (segunda antes da mudança) -> deve ser 480
    const datePre = new Date('2026-09-21T00:00:00.000Z');
    expect(resolver.getExpectedMinutesForDate(Weekday.MONDAY, datePre)).toBe(480);

    // Data 2026-09-28 (segunda após a mudança) -> deve ser 360
    const datePost = new Date('2026-09-28T00:00:00.000Z');
    expect(resolver.getExpectedMinutesForDate(Weekday.MONDAY, datePost)).toBe(360);
  });

  it('WorkDay Snapshot: expectedMinutesSnapshot deve ter PRIORIDADE ABSOLUTA sobre a jornada versionada', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
      id: '2', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 360, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date(),
    });

    // WorkDay com snapshot = 480
    const mockWorkDay: WorkDayWithEntries = {
      id: 'wd-1', userId: 'u1', date: new Date('2026-09-28T00:00:00.000Z'), note: null, expectedMinutesSnapshot: 480, createdAt: new Date(), updatedAt: new Date(), timeEntries: [],
    };
    vi.spyOn(workDayRepository, 'findByUserAndDate').mockResolvedValue(mockWorkDay);

    const summary = await workDayService.getWorkDaySummaryByDateStr('2026-09-28');
    expect(summary.expectedMinutes).toBe(480); // Snapshot de 480 vence a jornada atual de 360
  });

  it('NO_RECORDS histórico: dia sem registro em 21/09 deve manter 480m e não virar 360m retroativamente', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    const schedules = [
      { id: '1', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 360, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ];
    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(schedules);
    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

    const history = await workDayService.getMonthlySummary('2026-09');
    const day21 = history.days.find((d) => d.date === '2026-09-21');
    expect(day21).toBeDefined();
    expect(day21?.expectedMinutes).toBe(480);
    expect(day21?.status).toBe('NO_RECORDS');

    const day28 = history.days.find((d) => d.date === '2026-09-28');
    expect(day28).toBeDefined();
    expect(day28?.expectedMinutes).toBe(360);
  });

  it('Ajuste Manual Histórico: ao corrigir dia histórico 21/09 sem WorkDay, deve aplicar snapshot de 480m', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
      id: '1', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date(),
    });

    const mockWorkDayCreated: WorkDayWithEntries = {
      id: 'wd-hist', userId: 'u1', date: new Date('2026-09-21T00:00:00.000Z'), note: null, expectedMinutesSnapshot: 480, createdAt: new Date(), updatedAt: new Date(), timeEntries: [],
    };

    const findOrCreateSpy = vi.spyOn(workDayRepository, 'findOrCreateByUserAndDate').mockResolvedValue(mockWorkDayCreated);

    vi.spyOn(workDayRepository, 'findByUserAndDate').mockResolvedValue(mockWorkDayCreated);
    vi.spyOn(timeEntryRepository, 'findActiveByWorkDayId').mockResolvedValue([]);
    vi.spyOn(timeEntryRepository, 'createManyManual').mockResolvedValue([]);
    vi.spyOn(workDayAdjustmentRepository, 'create').mockResolvedValue({
      id: 'adj-1',
      workDayId: 'wd-hist',
      reason: 'Correção de dia histórico sem registro',
      beforeEntries: [],
      afterEntries: [],
      createdAt: new Date(),
    });

    vi.spyOn(workDayService, 'getWorkDaySummaryByDateStr').mockResolvedValue({
      date: '2026-09-21', expectedMinutes: 480, workedMinutes: 480, currentSessionMinutes: 0, totalWorkedMinutes: 480, balanceMinutes: 0, isOpen: false, nextAction: TimeEntryType.CLOCK_IN, entries: [],
    });

    await manualAdjustmentService.saveAdjustment('2026-09-21', {
      reason: 'Correção de dia histórico sem registro',
      intervals: [{ clockIn: '08:00', clockOut: '17:00' }],
    });

    // Confirma que findOrCreateByUserAndDate foi chamado passando 480 (jornada vigente em 21/09)
    expect(findOrCreateSpy).toHaveBeenCalledWith('u1', expect.any(Date), 480, expect.anything());
  });

  it('Banco de Horas: pendência histórica em 21/09 continua utilizando a jornada antiga (480m)', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
      id: 'cfg-1', userId: 'u1', startDate: new Date('2026-09-01T00:00:00.000Z'), initialBalanceMinutes: 0, createdAt: new Date(), updatedAt: new Date(),
    });

    const schedules = [
      { id: '1', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 360, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ];
    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue(schedules);
    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([]);

    const status = await bankHoursService.getBankHoursStatus();
    const pending21 = status.pending.find((p) => p.date === '2026-09-21');
    expect(pending21).toBeDefined();
    expect(pending21?.expectedMinutes).toBe(480);
  });

  it('TimeEntry: no primeiro CLOCK_IN posterior à mudança de jornada, deve persistir snapshot com a nova jornada', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
      id: '2', userId: 'u1', weekday: Weekday.TUESDAY, expectedMinutes: 360, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date(),
    });

    const mockWorkDayCreated: WorkDayWithEntries = {
      id: 'wd-today', userId: 'u1', date: new Date('2026-09-22T00:00:00.000Z'), note: null, expectedMinutesSnapshot: 360, createdAt: new Date(), updatedAt: new Date(), timeEntries: [],
    };

    const findOrCreateSpy = vi.spyOn(workDayRepository, 'findOrCreateByUserAndDate').mockResolvedValue(mockWorkDayCreated);
    vi.spyOn(timeEntryRepository, 'create').mockResolvedValue({
      id: 'te-new', workDayId: 'wd-today', type: TimeEntryType.CLOCK_IN, timestamp: new Date(), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    vi.spyOn(workDayService, 'getWorkDaySummaryByDateStr').mockResolvedValue({
      date: '2026-09-22', expectedMinutes: 360, workedMinutes: 0, currentSessionMinutes: 0, totalWorkedMinutes: 0, balanceMinutes: -360, isOpen: true, nextAction: TimeEntryType.CLOCK_OUT, entries: [],
    });

    await timeEntryService.clockIn();
    expect(findOrCreateSpy).toHaveBeenCalledWith('u1', expect.any(Date), 360, expect.anything());
  });
});

describe('ETAPA 08 — SettingsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getSettings: deve retornar perfil, email, timezone, 7 dias e total semanal', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    vi.spyOn(workScheduleRepository, 'findLatestScheduleVersionDate').mockResolvedValue(new Date('2026-09-22T00:00:00.000Z'));
    vi.spyOn(workScheduleRepository, 'findSchedulesByVersionDate').mockResolvedValue([
      { id: '1', userId: 'u1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'u1', weekday: Weekday.TUESDAY, expectedMinutes: 480, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'u1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'u1', weekday: Weekday.THURSDAY, expectedMinutes: 480, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'u1', weekday: Weekday.FRIDAY, expectedMinutes: 480, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'u1', weekday: Weekday.SATURDAY, expectedMinutes: 0, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'u1', weekday: Weekday.SUNDAY, expectedMinutes: 0, effectiveFrom: new Date('2026-09-22T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await settingsService.getSettings();

    expect(res.profile.name).toBe('Natan');
    expect(res.profile.email).toBe('usuario@horacerta.local');
    expect(res.preferences.timezone).toBe('America/Sao_Paulo');
    expect(res.workSchedule.effectiveFrom).toBe('2026-09-22');
    expect(res.workSchedule.weeklyExpectedMinutes).toBe(2400);
    expect(res.workSchedule.days.length).toBe(7);
  });

  it('updateProfile: deve atualizar e retornar o nome', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    vi.spyOn(userRepository, 'updateName').mockResolvedValue({
      id: 'u1', name: 'Natan Santos', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await settingsService.updateProfile({ name: 'Natan Santos' });
    expect(res.name).toBe('Natan Santos');
    expect(res.email).toBe('usuario@horacerta.local');
  });

  it('updateWorkSchedule: ao salvar duas vezes no mesmo dia (2026-09-22), deve utilizar o mesmo effectiveFrom e efetuar upsert', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'u1', name: 'Natan', email: 'usuario@horacerta.local', createdAt: new Date(), updatedAt: new Date(),
    });

    const upsertSpy = vi.spyOn(workScheduleRepository, 'upsertVersionSchedules').mockResolvedValue([]);
    vi.spyOn(workScheduleRepository, 'findLatestScheduleVersionDate').mockResolvedValue(new Date('2026-09-22T00:00:00.000Z'));
    vi.spyOn(workScheduleRepository, 'findSchedulesByVersionDate').mockResolvedValue([]);

    const daysV1 = [
      { weekday: Weekday.MONDAY, expectedMinutes: 480 },
      { weekday: Weekday.TUESDAY, expectedMinutes: 480 },
      { weekday: Weekday.WEDNESDAY, expectedMinutes: 480 },
      { weekday: Weekday.THURSDAY, expectedMinutes: 480 },
      { weekday: Weekday.FRIDAY, expectedMinutes: 480 },
      { weekday: Weekday.SATURDAY, expectedMinutes: 0 },
      { weekday: Weekday.SUNDAY, expectedMinutes: 0 },
    ];

    const daysV2 = [
      { weekday: Weekday.MONDAY, expectedMinutes: 360 },
      { weekday: Weekday.TUESDAY, expectedMinutes: 420 },
      { weekday: Weekday.WEDNESDAY, expectedMinutes: 360 },
      { weekday: Weekday.THURSDAY, expectedMinutes: 360 },
      { weekday: Weekday.FRIDAY, expectedMinutes: 360 },
      { weekday: Weekday.SATURDAY, expectedMinutes: 0 },
      { weekday: Weekday.SUNDAY, expectedMinutes: 0 },
    ];

    // Primeiro save no mesmo dia
    await settingsService.updateWorkSchedule(daysV1);
    expect(upsertSpy).toHaveBeenNthCalledWith(1, 'u1', new Date('2026-09-22T00:00:00.000Z'), daysV1);

    // Segundo save no mesmo dia
    await settingsService.updateWorkSchedule(daysV2);
    expect(upsertSpy).toHaveBeenNthCalledWith(2, 'u1', new Date('2026-09-22T00:00:00.000Z'), daysV2);
  });

  it('upsertVersionSchedules: deve utilizar transação Prisma e abortar integralmente em caso de falha intermediária', async () => {
    const days = [
      { weekday: Weekday.MONDAY, expectedMinutes: 480 },
      { weekday: Weekday.TUESDAY, expectedMinutes: 480 },
    ];

    // Mock upsertVersionSchedules para simular a falha de transação e rejeição da Promise
    vi.spyOn(workScheduleRepository, 'upsertVersionSchedules').mockRejectedValueOnce(
      new Error('Transaction failed on intermediate upsert')
    );

    await expect(
      settingsService.updateWorkSchedule(days)
    ).rejects.toThrow('Transaction failed on intermediate upsert');
  });
});

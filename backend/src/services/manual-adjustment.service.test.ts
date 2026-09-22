import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { manualAdjustmentService } from './manual-adjustment.service';
import { manualAdjustmentSchema } from '../schemas/manual-adjustment.schema';
import { dateParamSchema } from '../schemas/work-day.schema';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { timeEntryRepository } from '../repositories/time-entry.repository';
import { workDayAdjustmentRepository } from '../repositories/work-day-adjustment.repository';
import { prisma } from '../lib/prisma';
import { TimeEntryType, TimeEntrySource, Weekday, Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error';

describe('manualAdjustmentSchema', () => {
  it('deve rejeitar motivo vazio ou menor que 5 caracteres', () => {
    expect(
      manualAdjustmentSchema.safeParse({
        reason: '',
        intervals: [{ clockIn: '08:00', clockOut: '12:00' }],
      }).success
    ).toBe(false);

    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'abc',
        intervals: [{ clockIn: '08:00', clockOut: '12:00' }],
      }).success
    ).toBe(false);
  });

  it('deve aceitar motivo válido e intervalos corretos', () => {
    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Esqueci de registrar a saída.',
        intervals: [
          { clockIn: '08:00', clockOut: '12:00' },
          { clockIn: '13:00', clockOut: '17:00' },
        ],
      }).success
    ).toBe(true);
  });

  it('deve rejeitar lista de intervalos vazia ou com mais de 10 itens', () => {
    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [],
      }).success
    ).toBe(false);

    const elevenIntervals = Array.from({ length: 11 }).map(() => ({
      clockIn: '08:00',
      clockOut: '09:00',
    }));
    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: elevenIntervals,
      }).success
    ).toBe(false);
  });

  it('deve rejeitar formatos incorretos de horário', () => {
    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [{ clockIn: '8:00', clockOut: '12:00' }],
      }).success
    ).toBe(false);

    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [{ clockIn: '25:00', clockOut: '12:00' }],
      }).success
    ).toBe(false);

    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [{ clockIn: '08:00', clockOut: '12:70' }],
      }).success
    ).toBe(false);
  });

  it('deve rejeitar entrada maior ou igual à saída no mesmo intervalo', () => {
    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [{ clockIn: '12:00', clockOut: '08:00' }],
      }).success
    ).toBe(false);

    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [{ clockIn: '08:00', clockOut: '08:00' }],
      }).success
    ).toBe(false);
  });

  it('deve rejeitar intervalos sobrepostos ou com horários coincidentes', () => {
    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [
          { clockIn: '08:00', clockOut: '13:00' },
          { clockIn: '12:00', clockOut: '17:00' },
        ],
      }).success
    ).toBe(false);

    expect(
      manualAdjustmentSchema.safeParse({
        reason: 'Motivo válido de teste',
        intervals: [
          { clockIn: '08:00', clockOut: '12:00' },
          { clockIn: '12:00', clockOut: '17:00' },
        ],
      }).success
    ).toBe(false);
  });
});

describe('dateParamSchema', () => {
  it('deve aceitar datas reais no formato YYYY-MM-DD', () => {
    expect(dateParamSchema.safeParse('2026-09-15').success).toBe(true);
    expect(dateParamSchema.safeParse('2026-02-28').success).toBe(true);
  });

  it('deve rejeitar datas malformadas ou inexistentes no calendário (ex: 2026-02-31, 15/09/2026, abc)', () => {
    expect(dateParamSchema.safeParse('2026-02-31').success).toBe(false);
    expect(dateParamSchema.safeParse('2026-13-01').success).toBe(false);
    expect(dateParamSchema.safeParse('15/09/2026').success).toBe(false);
    expect(dateParamSchema.safeParse('abc').success).toBe(false);
  });
});

describe('ManualAdjustmentService - saveAdjustment & getAdjustments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'));

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => {
      return cb(prisma);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve bloquear ajuste manual para o dia atual (hoje) e para datas futuras', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Hoje = 2026-09-21
    await expect(
      manualAdjustmentService.saveAdjustment('2026-09-21', {
        reason: 'Ajuste de hoje',
        intervals: [{ clockIn: '08:00', clockOut: '12:00' }],
      })
    ).rejects.toThrow('O dia atual deve ser registrado pelo fluxo normal de ponto.');

    // Futuro = 2026-09-22
    await expect(
      manualAdjustmentService.saveAdjustment('2026-09-22', {
        reason: 'Ajuste futuro',
        intervals: [{ clockIn: '08:00', clockOut: '12:00' }],
      })
    ).rejects.toThrow('Não é possível ajustar manualmente uma data futura.');
  });

  it('deve resolver um dia NO_RECORDS histórico criando WorkDay, aplicando snapshot e gerando auditoria', async () => {
    const mockUser = {
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

    vi.spyOn(workScheduleRepository, 'findByUserAndWeekday').mockResolvedValue({
      id: 'sched-1',
      userId: 'user-1',
      weekday: Weekday.TUESDAY,
      expectedMinutes: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockWorkDayCreated: WorkDayWithEntries = {
      id: 'wd-15',
      userId: 'user-1',
      date: new Date('2026-09-15T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [],
    };

    vi.spyOn(workDayRepository, 'findOrCreateByUserAndDate').mockResolvedValue(
      mockWorkDayCreated
    );
    vi.spyOn(timeEntryRepository, 'findActiveByWorkDayId').mockResolvedValue([]);
    const softDeleteSpy = vi.spyOn(timeEntryRepository, 'softDeleteActiveByWorkDayId');

    const createdManualEntries = [
      { id: 'te-1', workDayId: 'wd-15', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-15T11:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'te-2', workDayId: 'wd-15', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-15T15:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'te-3', workDayId: 'wd-15', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-15T16:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'te-4', workDayId: 'wd-15', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-15T20:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    vi.spyOn(timeEntryRepository, 'createManyManual').mockResolvedValue(
      createdManualEntries
    );

    const auditSpy = vi.spyOn(workDayAdjustmentRepository, 'create').mockResolvedValue({
      id: 'adj-1',
      workDayId: 'wd-15',
      reason: 'Esqueci de bater o ponto.',
      beforeEntries: [],
      afterEntries: createdManualEntries.map((e) => ({
        type: e.type,
        timestamp: e.timestamp.toISOString(),
        source: e.source,
      })) as unknown as Prisma.JsonValue,
      createdAt: new Date('2026-09-21T12:00:00.000Z'),
    });

    vi.spyOn(workDayRepository, 'findByUserAndDate').mockResolvedValue({
      ...mockWorkDayCreated,
      timeEntries: createdManualEntries,
    });

    const res = await manualAdjustmentService.saveAdjustment('2026-09-15', {
      reason: 'Esqueci de bater o ponto.',
      intervals: [
        { clockIn: '08:00', clockOut: '12:00' },
        { clockIn: '13:00', clockOut: '17:00' },
      ],
    });

    expect(softDeleteSpy).toHaveBeenCalledWith('wd-15', expect.any(Date), expect.anything());
    expect(auditSpy).toHaveBeenCalledWith(
      'wd-15',
      'Esqueci de bater o ponto.',
      [],
      expect.any(Array),
      expect.anything()
    );
    expect(res.summary.expectedMinutes).toBe(480);
    expect(res.summary.totalWorkedMinutes).toBe(480);
    expect(res.summary.balanceMinutes).toBe(0);
    expect(res.adjustment.beforeEntries.length).toBe(0);
    expect(res.adjustment.afterEntries.length).toBe(4);
  });

  it('deve resolver um dia INCOMPLETE realizando soft delete dos registros antigos e salvando nova auditoria', async () => {
    const mockUser = {
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

    const existingWorkDay: WorkDayWithEntries = {
      id: 'wd-incomplete',
      userId: 'user-1',
      date: new Date('2026-09-16T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [
        { id: 'te-old-1', workDayId: 'wd-incomplete', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-16T11:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ],
    };

    vi.spyOn(workDayRepository, 'findOrCreateByUserAndDate').mockResolvedValue(
      existingWorkDay
    );
    vi.spyOn(timeEntryRepository, 'findActiveByWorkDayId').mockResolvedValue(
      existingWorkDay.timeEntries
    );
    const softDeleteSpy = vi.spyOn(timeEntryRepository, 'softDeleteActiveByWorkDayId');

    const createdManualEntries = [
      { id: 'te-m1', workDayId: 'wd-incomplete', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-16T11:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'te-m2', workDayId: 'wd-incomplete', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-16T15:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'te-m3', workDayId: 'wd-incomplete', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-16T16:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'te-m4', workDayId: 'wd-incomplete', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-16T20:00:00.000Z'), source: TimeEntrySource.MANUAL, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ];

    vi.spyOn(timeEntryRepository, 'createManyManual').mockResolvedValue(
      createdManualEntries
    );

    const auditSpy = vi.spyOn(workDayAdjustmentRepository, 'create').mockResolvedValue({
      id: 'adj-2',
      workDayId: 'wd-incomplete',
      reason: 'Completando horário de saída.',
      beforeEntries: existingWorkDay.timeEntries.map((e) => ({
        type: e.type,
        timestamp: e.timestamp.toISOString(),
        source: e.source,
      })) as unknown as Prisma.JsonValue,
      afterEntries: createdManualEntries.map((e) => ({
        type: e.type,
        timestamp: e.timestamp.toISOString(),
        source: e.source,
      })) as unknown as Prisma.JsonValue,
      createdAt: new Date('2026-09-21T12:00:00.000Z'),
    });

    vi.spyOn(workDayRepository, 'findByUserAndDate').mockResolvedValue({
      ...existingWorkDay,
      timeEntries: createdManualEntries,
    });

    const res = await manualAdjustmentService.saveAdjustment('2026-09-16', {
      reason: 'Completando horário de saída.',
      intervals: [
        { clockIn: '08:00', clockOut: '12:00' },
        { clockIn: '13:00', clockOut: '17:00' },
      ],
    });

    expect(softDeleteSpy).toHaveBeenCalledWith(
      'wd-incomplete',
      expect.any(Date),
      expect.anything()
    );
    expect(res.adjustment.beforeEntries.length).toBe(1);
    expect(res.adjustment.afterEntries.length).toBe(4);
    expect(auditSpy).toHaveBeenCalled();
  });

  it('deve tratar erro de concorrência P2034 retornando HTTP 409 CONCURRENCY_CONFLICT', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const p2034Error = new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict or a deadlock',
      { code: 'P2034', clientVersion: '6.0.0' }
    );

    vi.spyOn(prisma, '$transaction').mockRejectedValue(p2034Error);

    try {
      await manualAdjustmentService.saveAdjustment('2026-09-15', {
        reason: 'Conflito simulado',
        intervals: [{ clockIn: '08:00', clockOut: '12:00' }],
      });
      expect.fail('Deveria ter lançado AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe('CONCURRENCY_CONFLICT');
      expect(appErr.message).toBe(
        'Os registros deste dia foram alterados durante o ajuste. Atualize os dados e tente novamente.'
      );
    }
  });

  it('deve simular falha na transação e propagar erro sem concluir ajuste', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(workScheduleRepository, 'findByUserAndWeekday').mockResolvedValue({
      id: 'sched-1',
      userId: 'user-1',
      weekday: Weekday.TUESDAY,
      expectedMinutes: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(workDayRepository, 'findOrCreateByUserAndDate').mockResolvedValue({
      id: 'wd-rollback',
      userId: 'user-1',
      date: new Date('2026-09-15T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [],
    });

    vi.spyOn(timeEntryRepository, 'findActiveByWorkDayId').mockResolvedValue([]);
    vi.spyOn(timeEntryRepository, 'softDeleteActiveByWorkDayId').mockResolvedValue({ count: 0 });

    // Erro ao tentar criar as novas entradas dentro da transação
    vi.spyOn(timeEntryRepository, 'createManyManual').mockRejectedValue(
      new Error('Erro de banco simulado pós soft-delete')
    );

    await expect(
      manualAdjustmentService.saveAdjustment('2026-09-15', {
        reason: 'Ajuste com falha interna',
        intervals: [{ clockIn: '08:00', clockOut: '12:00' }],
      })
    ).rejects.toThrow('Erro de banco simulado pós soft-delete');
  });

  it('deve retornar a lista de auditoria de um dia por ordem decrescente de criação', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockWorkDay: WorkDayWithEntries = {
      id: 'wd-audit',
      userId: 'user-1',
      date: new Date('2026-09-15T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [],
    };

    vi.spyOn(workDayRepository, 'findByUserAndDate').mockResolvedValue(mockWorkDay);

    const snapshot1: Prisma.JsonValue = [{ type: 'CLOCK_IN', timestamp: '2026-09-15T11:00:00.000Z', source: 'MANUAL' }];
    const snapshot2: Prisma.JsonValue = [{ type: 'CLOCK_IN', timestamp: '2026-09-15T11:00:00.000Z', source: 'MANUAL' }, { type: 'CLOCK_OUT', timestamp: '2026-09-15T19:00:00.000Z', source: 'MANUAL' }];

    vi.spyOn(workDayAdjustmentRepository, 'findByWorkDayId').mockResolvedValue([
      {
        id: 'adj-latest',
        workDayId: 'wd-audit',
        reason: 'Segundo ajuste manual.',
        beforeEntries: snapshot1,
        afterEntries: snapshot2,
        createdAt: new Date('2026-09-20T10:00:00.000Z'),
      },
      {
        id: 'adj-first',
        workDayId: 'wd-audit',
        reason: 'Primeiro ajuste manual.',
        beforeEntries: [] as Prisma.JsonValue,
        afterEntries: snapshot1,
        createdAt: new Date('2026-09-18T10:00:00.000Z'),
      },
    ]);

    const res = await manualAdjustmentService.getAdjustments('2026-09-15');

    expect(res.date).toBe('2026-09-15');
    expect(res.adjustments.length).toBe(2);
    expect(res.adjustments[0].id).toBe('adj-latest');
    expect(res.adjustments[1].id).toBe('adj-first');
  });
});

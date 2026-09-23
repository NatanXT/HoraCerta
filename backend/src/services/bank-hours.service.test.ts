import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bankHoursService } from './bank-hours.service';
import { workDayService } from './work-day.service';
import { userRepository } from '../repositories/user.repository';
import { workDayRepository, WorkDayWithEntries } from '../repositories/work-day.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { bankHoursConfigRepository } from '../repositories/bank-hours-config.repository';
import { saveBankHoursConfigSchema } from '../schemas/bank-hours.schema';
import { TimeEntryType, TimeEntrySource, Weekday } from '@prisma/client';

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

  it('deve calcular corretamente saldos consolidados, de hoje, ao vivo, créditos, débitos e pendências', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Config: startDate 2026-09-01, initialBalanceMinutes = 60 (+01h00)
    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
      id: 'cfg-1',
      userId: 'user-1',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      initialBalanceMinutes: 60,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Schedules: Mon-Fri = 480m, Sat-Sun = 0m
    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.MONDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '2', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '3', userId: 'user-1', weekday: Weekday.WEDNESDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '4', userId: 'user-1', weekday: Weekday.THURSDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '5', userId: 'user-1', weekday: Weekday.FRIDAY, expectedMinutes: 480, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '6', userId: 'user-1', weekday: Weekday.SATURDAY, expectedMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
      { id: '7', userId: 'user-1', weekday: Weekday.SUNDAY, expectedMinutes: 0, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    // WorkDays:
    // Dia A (01/09 Terça): RECORDED (Worked 510m vs expected 480m -> +30m)
    // Dia B (02/09 Quarta): RECORDED (Worked 450m vs expected 480m -> -30m)
    // Dia C (03/09 Quinta): NO_RECORDS (expected 480m, no entries -> Pending, no debit!)
    // Dia D (04/09 Sexta): INCOMPLETE (expected 480m, open CLOCK_IN -> Pending)
    // Dia E (06/09 Domingo): REST_DAY sem registros -> expected 0m, neutral
    // Dia F (07/09 Segunda): Folga no snapshot com expected 0m e worked 120m -> RECORDED, +120m crédito
    // Dia G (21/09 Hoje): IN_PROGRESS (Worked 240m vs 480m -> todayBalance = -240m)

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
          { id: 'te-1', workDayId: 'wd-1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-01T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-2', workDayId: 'wd-1', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-01T16:30:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-2',
        userId: 'user-1',
        date: new Date('2026-09-02T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-3', workDayId: 'wd-2', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-02T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-4', workDayId: 'wd-2', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-02T15:30:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-4',
        userId: 'user-1',
        date: new Date('2026-09-04T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-5', workDayId: 'wd-4', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-04T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-7',
        userId: 'user-1',
        date: new Date('2026-09-07T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-6', workDayId: 'wd-7', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-07T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-7', workDayId: 'wd-7', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-07T10:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-21',
        userId: 'user-1',
        date: new Date('2026-09-21T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-8', workDayId: 'wd-21', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-21T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ];

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue(mockWorkDays);

    const res = await bankHoursService.getBankHoursStatus();

    expect(res.configured).toBe(true);
    expect(res.summary).not.toBeNull();

    const s = res.summary!;
    expect(s.initialBalanceMinutes).toBe(60);
    expect(s.creditMinutes).toBe(150);
    expect(s.debitMinutes).toBe(30);
    expect(s.consolidatedBalanceMinutes).toBe(180);
    expect(s.todayBalanceMinutes).toBe(-240);
    expect(s.liveBalanceMinutes).toBe(-60);
    expect(s.accountedDays).toBe(3);
    expect(s.pendingDays).toBe(11);

    // Validações explícitas da lista de pendências
    expect(res.pending.length).toBe(s.pendingDays);

    const pending03 = res.pending.find((p) => p.date === '2026-09-03');
    expect(pending03).toEqual({
      date: '2026-09-03',
      status: 'NO_RECORDS',
      expectedMinutes: 480,
      totalWorkedMinutes: 0,
    });

    const pending04 = res.pending.find((p) => p.date === '2026-09-04');
    expect(pending04).toEqual({
      date: '2026-09-04',
      status: 'INCOMPLETE',
      expectedMinutes: 480,
      totalWorkedMinutes: 0,
    });

    const pending06 = res.pending.find((p) => p.date === '2026-09-06');
    expect(pending06).toBeUndefined(); // REST_DAY sem ponto não é pendência

    const pending01 = res.pending.find((p) => p.date === '2026-09-01');
    expect(pending01).toBeUndefined(); // RECORDED não é pendência

    const pending21 = res.pending.find((p) => p.date === '2026-09-21');
    expect(pending21).toBeUndefined(); // Hoje não entra nas pendências históricas
  });

  it('deve ignorar completamente registros e pendências anteriores à startDate', async () => {
    vi.spyOn(userRepository, 'findByEmail').mockResolvedValue({
      id: 'user-1',
      name: 'Usuário Teste',
      email: 'usuario@horacerta.local',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Config: startDate = 2026-09-01
    vi.spyOn(bankHoursConfigRepository, 'findByUserId').mockResolvedValue({
      id: 'cfg-1',
      userId: 'user-1',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      initialBalanceMinutes: 60,
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

    // WorkDays retornados pelo banco (incluindo datas anteriores ao range de startDate)
    const mockWorkDays: WorkDayWithEntries[] = [
      {
        id: 'wd-old-incomplete',
        userId: 'user-1',
        date: new Date('2026-08-30T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-old-1', workDayId: 'wd-old-incomplete', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-08-30T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-old-extra',
        userId: 'user-1',
        date: new Date('2026-08-31T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-old-2', workDayId: 'wd-old-extra', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-08-31T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-old-3', workDayId: 'wd-old-extra', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-08-31T18:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
      {
        id: 'wd-sept-1',
        userId: 'user-1',
        date: new Date('2026-09-01T00:00:00.000Z'),
        note: null,
        expectedMinutesSnapshot: 480,
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntries: [
          { id: 'te-sep-1', workDayId: 'wd-sept-1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-01T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
          { id: 'te-sep-2', workDayId: 'wd-sept-1', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-01T16:30:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        ],
      },
    ];

    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue(mockWorkDays);

    const res = await bankHoursService.getBankHoursStatus();

    expect(res.period?.startDate).toBe('2026-09-01');

    // Somente o registro de 01/09 (+30m) deve entrar. Os +120m de 31/08 devem ser completamente ignorados.
    expect(res.summary?.creditMinutes).toBe(30);
    expect(res.summary?.consolidatedBalanceMinutes).toBe(90); // 60 initial + 30 = 90
    expect(res.summary?.accountedDays).toBe(1);

    // Registros anteriores a 01/09 não devem constar em pendências
    const pendingAugust = res.pending.find((p) => p.date < '2026-09-01');
    expect(pendingAugust).toBeUndefined();

    // Resumo mensal não deve conter 2026-08
    const monthAugust = res.monthly.find((m) => m.month === '2026-08');
    expect(monthAugust).toBeUndefined();
  });

  it('deve usar o snapshot da jornada histórica mesmo que o WorkSchedule atual tenha mudado', async () => {
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

    vi.spyOn(workScheduleRepository, 'findEffectiveByUserWeekdayAndDate').mockResolvedValue({
      id: '1',
      userId: 'user-1',
      weekday: Weekday.TUESDAY,
      expectedMinutes: 360,
      effectiveFrom: new Date('2000-01-01T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(workScheduleRepository, 'findAllVersionsByUserUntilDate').mockResolvedValue([
      { id: '1', userId: 'user-1', weekday: Weekday.TUESDAY, expectedMinutes: 360, effectiveFrom: new Date('2000-01-01T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() },
    ]);

    const mockWorkDay: WorkDayWithEntries = {
      id: 'wd-1',
      userId: 'user-1',
      date: new Date('2026-09-01T00:00:00.000Z'),
      note: null,
      expectedMinutesSnapshot: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeEntries: [
        { id: 'te-1', workDayId: 'wd-1', type: TimeEntryType.CLOCK_IN, timestamp: new Date('2026-09-01T08:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 'te-2', workDayId: 'wd-1', type: TimeEntryType.CLOCK_OUT, timestamp: new Date('2026-09-01T16:00:00.000Z'), source: TimeEntrySource.CLOCK, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ],
    };

    vi.spyOn(workDayRepository, 'findByUserAndDate').mockResolvedValue(mockWorkDay);
    vi.spyOn(workDayRepository, 'findByUserAndDateRange').mockResolvedValue([mockWorkDay]);

    const summary = await workDayService.getWorkDaySummaryByDateStr('2026-09-01');
    expect(summary.expectedMinutes).toBe(480);
    expect(summary.balanceMinutes).toBe(0);

    const bankStatus = await bankHoursService.getBankHoursStatus();
    expect(bankStatus.summary?.creditMinutes).toBe(0);
    expect(bankStatus.summary?.consolidatedBalanceMinutes).toBe(0);
  });
});

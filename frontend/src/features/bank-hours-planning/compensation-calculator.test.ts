import { describe, it, expect } from 'vitest';
import {
  calculateCompensationSimulation,
  generateCivilDateRange,
  addDaysCivilDate,
  evaluateCalendarInterval,
  isValidCivilDate,
  validateWorkSchedule,
  ALL_WEEKDAYS,
} from './compensation-calculator';
import { WorkScheduleDay } from '../../types/settings';
import { Holiday } from '../../types/holiday';
import { CalendarOccurrence } from '../../types/calendar-occurrence';

describe('Compensation Calculator — Bank Hours Planning Suite', () => {
  const standardWorkSchedule: WorkScheduleDay[] = [
    { weekday: 'MONDAY', expectedMinutes: 480 },
    { weekday: 'TUESDAY', expectedMinutes: 480 },
    { weekday: 'WEDNESDAY', expectedMinutes: 480 },
    { weekday: 'THURSDAY', expectedMinutes: 480 },
    { weekday: 'FRIDAY', expectedMinutes: 480 },
    { weekday: 'SATURDAY', expectedMinutes: 0 },
    { weekday: 'SUNDAY', expectedMinutes: 0 },
  ];

  it('1. gera intervalo de datas civis corretamente e suporta virada de mês e ano', () => {
    const novDates = generateCivilDateRange('2026-11-28', '2026-12-02');
    expect(novDates).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);

    const yearCross = generateCivilDateRange('2026-12-30', '2027-01-02');
    expect(yearCross).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);

    expect(generateCivilDateRange('2026-11-20', '2026-11-19')).toEqual([]);
    expect(addDaysCivilDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('2. cálculo com saldo negativo no Modo A (recuperar débito para meta zero)', () => {
    // Hoje: domingo 2026-11-15. Amanhã: segunda 2026-11-16.
    // Prazo: sexta 2026-11-20 (5 dias úteis: seg, ter, qua, qui, sex).
    // Saldo atual: -300 min (-5h). Meta: 0 min.
    // Necessário: 300 min / 5 dias = 60 min/dia.
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -300,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(true);
    expect(res.isTargetAchieved).toBe(false);
    expect(res.hasEligibleDays).toBe(true);
    expect(res.breakdown.eligibleDaysCount).toBe(5);
    expect(res.minutesToCompensate).toBe(300);
    expect(res.suggestedDailyMinutes).toBe(60);
    expect(res.projectedBalanceModeA).toBe(0);
  });

  it('3. cálculo com saldo positivo aumentando a meta no Modo A', () => {
    // Hoje: domingo 2026-11-15.
    // Saldo atual: +120 min (+2h). Meta: +300 min (+5h).
    // 5 dias úteis. Minutos a compensar: 180 min.
    // Sugerido: 180 / 5 = 36 min/dia.
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: 120,
        targetBalanceMinutes: 300,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(true);
    expect(res.minutesToCompensate).toBe(180);
    expect(res.suggestedDailyMinutes).toBe(36);
    expect(res.projectedBalanceModeA).toBe(300);
  });

  it('4. meta já atingida (saldo atual maior ou igual à meta)', () => {
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: 120,
        targetBalanceMinutes: 60,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(true);
    expect(res.isTargetAchieved).toBe(true);
    expect(res.minutesToCompensate).toBe(0);
    expect(res.suggestedDailyMinutes).toBe(0);
    expect(res.projectedBalanceModeA).toBe(120);
  });

  it('5. período sem nenhum dia elegível (zero dias úteis — divisão por zero prevenida)', () => {
    // Sexta-feira 2026-11-20. Amanhã é sábado 21 e domingo 22.
    // Prazo: domingo 2026-11-22.
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-22',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-22',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-20'
    );

    expect(res.isValid).toBe(true);
    expect(res.hasEligibleDays).toBe(false);
    expect(res.breakdown.eligibleDaysCount).toBe(0);
    expect(res.breakdown.scheduleOffDaysCount).toBe(2);
    expect(res.suggestedDailyMinutes).toBe(0);
    expect(res.projectedBalanceModeA).toBe(-120);
  });

  it('6. exclusão correta de feriados cadastrados no período', () => {
    // Segunda 2026-11-16 a Sexta 2026-11-20 (5 dias).
    // Feriado na quarta-feira 2026-11-18.
    const holidays: Holiday[] = [
      { id: 'h1', date: '2026-11-18', name: 'Feriado Municipal', source: 'BRASIL_API' },
    ];

    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -240,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays,
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(true);
    expect(res.breakdown.eligibleDaysCount).toBe(4);
    expect(res.breakdown.holidayDaysCount).toBe(1);
    expect(res.suggestedDailyMinutes).toBe(60); // 240 / 4 = 60 min/dia
  });

  it('7. exclusão correta de ausências e férias (CalendarOccurrence) no período', () => {
    // Segunda 2026-11-16 a Sexta 2026-11-20 (5 dias).
    // Ocorrência de férias na quinta e sexta: 2026-11-19 a 2026-11-20.
    const occurrences: CalendarOccurrence[] = [
      {
        id: 'occ1',
        type: 'VACATION',
        title: 'Férias',
        startDate: '2026-11-19',
        endDate: '2026-11-20',
        note: null,
      },
    ];

    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -300,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences,
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(true);
    expect(res.breakdown.eligibleDaysCount).toBe(3); // Seg, Ter, Qua
    expect(res.breakdown.occurrenceDaysCount).toBe(2); // Qui, Sex
    expect(res.suggestedDailyMinutes).toBe(100); // 300 / 3 = 100 min/dia
  });

  it('8. perfil com expediente aos sábados considera sábado como dia elegível', () => {
    const scheduleWithSaturday: WorkScheduleDay[] = [
      ...standardWorkSchedule.filter((d) => d.weekday !== 'SATURDAY'),
      { weekday: 'SATURDAY', expectedMinutes: 240 },
    ];

    // Sexta 2026-11-20 a Domingo 2026-11-22.
    // Amanhã é sábado 2026-11-21 (elegível) e domingo 2026-11-22 (folga).
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -60,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-22',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-22',
        workScheduleDays: scheduleWithSaturday,
        holidays: [],
        occurrences: [],
      },
      '2026-11-20'
    );

    expect(res.isValid).toBe(true);
    expect(res.breakdown.eligibleDaysCount).toBe(1); // Sábado é elegível
    expect(res.breakdown.scheduleOffDaysCount).toBe(1); // Domingo é folga
    expect(res.suggestedDailyMinutes).toBe(60);
  });

  it('9. arredondamento por teto (Math.ceil) garante alcance da meta com números fracionados', () => {
    // Débito: 100 minutos sobre 3 dias elegíveis.
    // 100 / 3 = 33.33 -> Math.ceil = 34 min/dia.
    // 34 * 3 = 102 minutos compensados -> Saldo projetado: -100 + 102 = +2 min.
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -100,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-18', // Seg, Ter, Qua = 3 dias
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-18',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(true);
    expect(res.breakdown.eligibleDaysCount).toBe(3);
    expect(res.suggestedDailyMinutes).toBe(34);
    expect(res.projectedBalanceModeA).toBe(2);
  });

  it('10. simulação no Modo B (acréscimo fixo diário e detecção de data de alcance da meta)', () => {
    // Saldo: -180 min (-3h). Meta: 0 min.
    // Período: 5 dias úteis (Segunda 2026-11-16 a Sexta 2026-11-20).
    // Usuário escolhe compensar 60 min/dia.
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -180,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 60,
        mode: 'DAILY_ADDITION',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(true);
    expect(res.breakdown.eligibleDaysCount).toBe(5);
    expect(res.totalCompensatedModeB).toBe(300);
    expect(res.projectedBalanceModeB).toBe(120);
    expect(res.differenceFromTargetModeB).toBe(120);
    expect(res.targetReachedDateModeB).toBe('2026-11-18');
  });

  it('11. simulação atravessando fim de ano com feriado de 1 de janeiro', () => {
    const holidays: Holiday[] = [
      { id: 'new_year', date: '2027-01-01', name: 'Confraternização Universal', source: 'BRASIL_API' },
    ];

    const evalResult = evaluateCalendarInterval('2026-12-30', '2027-01-04', {
      userId: 'u1',
      targetDateStr: '2027-01-04',
      workScheduleDays: standardWorkSchedule,
      holidays,
      occurrences: [],
    });

    expect(evalResult.breakdown.totalCalendarDays).toBe(6);
    expect(evalResult.breakdown.eligibleDaysCount).toBe(3);
    expect(evalResult.breakdown.holidayDaysCount).toBe(1);
    expect(evalResult.breakdown.scheduleOffDaysCount).toBe(2);
  });

  it('12. bloqueia projeção quando configuração de expediente estiver ausente ou incompleta (sem fallback inventado)', () => {
    const resEmptySchedule = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: [], // Sem jornada definida
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(resEmptySchedule.isValid).toBe(false);
    expect(resEmptySchedule.validationErrors.scheduleError).toMatch(/Configuração de expediente/);
    expect(resEmptySchedule.breakdown.eligibleDaysCount).toBe(0);
  });

  it('13. rejeita meta de saldo nula ou NaN com erro de validação explícito', () => {
    const res = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: null, // Input inválido
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );

    expect(res.isValid).toBe(false);
    expect(res.validationErrors.targetBalanceError).toMatch(/Formato de meta de saldo inválido/);
  });

  it('14. rejeita data igual a hoje, data no passado ou data além de 365 dias', () => {
    // Data igual a hoje
    const resToday = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-15',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-15',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resToday.isValid).toBe(false);
    expect(resToday.validationErrors.dateRangeError).toMatch(/posterior à data atual/);

    // Data no passado
    const resPast = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-10',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-10',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resPast.isValid).toBe(false);

    // Data além de 365 dias
    const resOver365 = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2027-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2027-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resOver365.isValid).toBe(false);
    expect(resOver365.validationErrors.dateRangeError).toMatch(/365 dias/);
  });

  it('15. Modo B valida acréscimo diário inválido (zero, negativo, NaN ou acima de 480 min)', () => {
    const resZero = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0, // Inválido para Modo B
        mode: 'DAILY_ADDITION',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resZero.isValid).toBe(false);
    expect(resZero.validationErrors.dailyAdditionError).toMatch(/maior que zero/);

    const resOverMax = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 500, // Acima de 480
        mode: 'DAILY_ADDITION',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resOverMax.isValid).toBe(false);
    expect(resOverMax.validationErrors.dailyAdditionError).toMatch(/480 min/);
  });

  it('16. validação de datas civis reais e rejeição de datas inexistentes (ETAPA 12.4.2)', () => {
    // Datas civis válidas
    expect(isValidCivilDate('2026-11-15')).toBe(true);
    expect(isValidCivilDate('2024-02-29')).toBe(true); // Ano bissexto
    expect(isValidCivilDate('2026-12-31')).toBe(true);

    // Datas civis inexistentes ou com formato corrompido
    expect(isValidCivilDate('2026-02-30')).toBe(false); // Fevereiro nunca tem 30 dias
    expect(isValidCivilDate('2026-11-31')).toBe(false); // Novembro tem 30 dias
    expect(isValidCivilDate('2025-02-29')).toBe(false); // 2025 não é bissexto
    expect(isValidCivilDate('2026-13-01')).toBe(false); // Mês 13 inexistente
    expect(isValidCivilDate('2026-00-10')).toBe(false); // Mês 0 inexistente
    expect(isValidCivilDate('texto_invalido')).toBe(false);
    expect(isValidCivilDate('')).toBe(false);
    expect(isValidCivilDate(null as any)).toBe(false);

    // Rejeição direta na simulação sem lançar exceções não tratadas
    const resFeb30 = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-02-30',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-02-30',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-02-15'
    );
    expect(resFeb30.isValid).toBe(false);
    expect(resFeb30.validationErrors.dateRangeError).toBe(
      'Data limite inválida ou inexistente no calendário.'
    );

    const resNov31 = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-31',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-31',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resNov31.isValid).toBe(false);
    expect(resNov31.validationErrors.dateRangeError).toBe(
      'Data limite inválida ou inexistente no calendário.'
    );

    const resInvalidText = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: 'data_corrompida',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: 'data_corrompida',
        workScheduleDays: standardWorkSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resInvalidText.isValid).toBe(false);
    expect(resInvalidText.validationErrors.dateRangeError).toBe(
      'Data limite inválida ou inexistente no calendário.'
    );
  });

  it('17. validação rigorosa do contrato canônico de expediente semanal (7 dias obrigatórios) (ETAPA 12.4.2)', () => {
    // 7 dias canônicos válidos
    expect(validateWorkSchedule(standardWorkSchedule).isValid).toBe(true);

    // 7 dias com 0 minutos (todos folga) é contratualmente válido
    const allOffSchedule: WorkScheduleDay[] = ALL_WEEKDAYS.map((weekday) => ({
      weekday,
      expectedMinutes: 0,
    }));
    expect(validateWorkSchedule(allOffSchedule).isValid).toBe(true);

    // Simulação com 7 dias de folga: válido, mas sem dias elegíveis
    const resAllOff = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: allOffSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resAllOff.isValid).toBe(true);
    expect(resAllOff.hasEligibleDays).toBe(false);
    expect(resAllOff.breakdown.eligibleDaysCount).toBe(0);
    expect(resAllOff.suggestedDailyMinutes).toBe(0);

    // Rejeita expediente com apenas 6 dias (ex: sem SUNDAY)
    const sixDaysSchedule = standardWorkSchedule.filter((d) => d.weekday !== 'SUNDAY');
    const sixDaysValidation = validateWorkSchedule(sixDaysSchedule);
    expect(sixDaysValidation.isValid).toBe(false);
    expect(sixDaysValidation.errorMessage).toMatch(/todos os 7 dias da semana/);

    const resSixDays = calculateCompensationSimulation(
      {
        currentBalanceMinutes: -120,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-20',
        dailyAdditionMinutes: 0,
        mode: 'TARGET_DATE',
      },
      {
        userId: 'u1',
        targetDateStr: '2026-11-20',
        workScheduleDays: sixDaysSchedule,
        holidays: [],
        occurrences: [],
      },
      '2026-11-15'
    );
    expect(resSixDays.isValid).toBe(false);
    expect(resSixDays.validationErrors.scheduleError).toMatch(/todos os 7 dias da semana/);

    // Rejeita expediente com dias duplicados (ex: 2 MONDAYs e sem TUESDAY)
    const duplicateSchedule: WorkScheduleDay[] = [
      { weekday: 'MONDAY', expectedMinutes: 480 },
      { weekday: 'MONDAY', expectedMinutes: 480 },
      { weekday: 'WEDNESDAY', expectedMinutes: 480 },
      { weekday: 'THURSDAY', expectedMinutes: 480 },
      { weekday: 'FRIDAY', expectedMinutes: 480 },
      { weekday: 'SATURDAY', expectedMinutes: 0 },
      { weekday: 'SUNDAY', expectedMinutes: 0 },
    ];
    const dupValidation = validateWorkSchedule(duplicateSchedule);
    expect(dupValidation.isValid).toBe(false);
    expect(dupValidation.errorMessage).toMatch(/duplicados/);

    // Rejeita carga horária negativa
    const negativeMinutesSchedule: WorkScheduleDay[] = [
      { weekday: 'MONDAY', expectedMinutes: -60 },
      { weekday: 'TUESDAY', expectedMinutes: 480 },
      { weekday: 'WEDNESDAY', expectedMinutes: 480 },
      { weekday: 'THURSDAY', expectedMinutes: 480 },
      { weekday: 'FRIDAY', expectedMinutes: 480 },
      { weekday: 'SATURDAY', expectedMinutes: 0 },
      { weekday: 'SUNDAY', expectedMinutes: 0 },
    ];
    const negValidation = validateWorkSchedule(negativeMinutesSchedule);
    expect(negValidation.isValid).toBe(false);
    expect(negValidation.errorMessage).toMatch(/carga horária inválida/);

    // Rejeita carga horária decimal (não-inteiro)
    const floatMinutesSchedule: WorkScheduleDay[] = [
      { weekday: 'MONDAY', expectedMinutes: 480.5 },
      { weekday: 'TUESDAY', expectedMinutes: 480 },
      { weekday: 'WEDNESDAY', expectedMinutes: 480 },
      { weekday: 'THURSDAY', expectedMinutes: 480 },
      { weekday: 'FRIDAY', expectedMinutes: 480 },
      { weekday: 'SATURDAY', expectedMinutes: 0 },
      { weekday: 'SUNDAY', expectedMinutes: 0 },
    ];
    const floatValidation = validateWorkSchedule(floatMinutesSchedule);
    expect(floatValidation.isValid).toBe(false);
    expect(floatValidation.errorMessage).toMatch(/carga horária inválida/);
  });
});

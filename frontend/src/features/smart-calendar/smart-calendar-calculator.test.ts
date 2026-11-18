import { describe, it, expect } from 'vitest';
import {
  isLeapYear,
  getDaysInCivilMonth,
  getWeekdayNamesForDate,
  calculateLeadInSlots,
  resolveDayIndicators,
  buildDayAriaLabel,
  buildSmartCalendarGrid,
} from './smart-calendar-calculator';
import { MonthlyDaySummary } from '../../types/work-day';

describe('SmartCalendarCalculator — Pure Calculations & Indicator Resolution', () => {
  const TODAY_STR = '2026-11-17';

  it('1. calcula anos bissextos e dias de fevereiro corretamente', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);

    expect(getDaysInCivilMonth(2024, 2)).toBe(29);
    expect(getDaysInCivilMonth(2026, 2)).toBe(28);
    expect(getDaysInCivilMonth(2026, 4)).toBe(30);
    expect(getDaysInCivilMonth(2026, 12)).toBe(31);
  });

  it('2. calcula leadInSlots com semana iniciando na segunda-feira', () => {
    // 2026-11-01 é Domingo -> no calendário Segunda-primeiro, o domingo fica na 7ª coluna (índice 6)
    // leadInSlots = 6 (Seg, Ter, Qua, Qui, Sex, Sáb são os 6 slots anteriores)
    expect(calculateLeadInSlots('2026-11-01')).toBe(6);

    // 2026-06-01 é Segunda-feira -> leadInSlots = 0
    expect(calculateLeadInSlots('2026-06-01')).toBe(0);

    // 2026-12-01 é Terça-feira -> leadInSlots = 1
    expect(calculateLeadInSlots('2026-12-01')).toBe(1);
  });

  it('3. identifica nomes de dias da semana em português corretamente', () => {
    const monday = getWeekdayNamesForDate('2026-11-16');
    expect(monday.short).toBe('Seg');
    expect(monday.long).toBe('Segunda-feira');

    const sunday = getWeekdayNamesForDate('2026-11-15');
    expect(sunday.short).toBe('Dom');
    expect(sunday.long).toBe('Domingo');
  });

  it('4. suporta coexistência de múltiplos indicadores sem descartar dados', () => {
    const complexDay: MonthlyDaySummary = {
      date: '2026-11-15',
      expectedMinutes: 480,
      workedMinutes: 510,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 510,
      balanceMinutes: 30, // saldo diário positivo
      isOpen: false,
      status: 'RECORDED',
      hasManualAdjustments: true, // ajuste manual
      entries: [
        { id: '1', type: 'CLOCK_IN', timestamp: '2026-11-15T08:00:00Z', source: 'CLOCK' },
        { id: '2', type: 'CLOCK_OUT', timestamp: '2026-11-15T17:30:00Z', source: 'MANUAL' },
      ],
      holiday: {
        id: 'h1',
        name: 'Proclamação da República',
        type: 'NATIONAL',
        date: '2026-11-15',
      },
      occurrence: {
        id: 'occ1',
        type: 'BANK_HOURS_LEAVE',
        title: 'Compensação planejada',
        startDate: '2026-11-15',
        endDate: '2026-11-15',
        note: null,
      },
    };

    const indicators = resolveDayIndicators(complexDay, TODAY_STR);

    // Todos os indicadores coexistem simultaneamente
    expect(indicators.isHoliday).toBe(true);
    expect(indicators.isAbsenceOrLeave).toBe(true);
    expect(indicators.isCompletedWorkday).toBe(true);
    expect(indicators.isPositiveBalance).toBe(true);
    expect(indicators.hasManualAdjustment).toBe(true);
    expect(indicators.isNegativeBalance).toBe(false);
    expect(indicators.isOpenWorkday).toBe(false);

    // Sintetiza aria-label acessível com todas as informações
    const aria = buildDayAriaLabel(complexDay, indicators, 'Domingo');
    expect(aria).toContain('Dia 15, Domingo');
    expect(aria).toContain('Feriado: Proclamação da República');
    expect(aria).toContain('Ausência/Afastamento: Compensação planejada');
    expect(aria).toContain('Jornada concluída: 08h30 trabalhados');
    expect(aria).toContain('Saldo positivo: +00h30');
    expect(aria).toContain('Contém ajuste manual');
  });

  it('5. identifica dia com jornada em andamento (aberta)', () => {
    const openDay: MonthlyDaySummary = {
      date: TODAY_STR,
      expectedMinutes: 480,
      workedMinutes: 240,
      currentSessionMinutes: 60,
      totalWorkedMinutes: 300,
      balanceMinutes: -180,
      isOpen: true,
      status: 'IN_PROGRESS',
      entries: [{ id: '1', type: 'CLOCK_IN', timestamp: `${TODAY_STR}T08:00:00Z` }],
    };

    const indicators = resolveDayIndicators(openDay, TODAY_STR);
    expect(indicators.isToday).toBe(true);
    expect(indicators.isOpenWorkday).toBe(true);
    expect(indicators.isCompletedWorkday).toBe(false);
    expect(indicators.isNegativeBalance).toBe(true);

    const aria = buildDayAriaLabel(openDay, indicators, 'Terça-feira');
    expect(aria).toContain('Hoje');
    expect(aria).toContain('Expediente em andamento (05h00 trabalhados)');
    expect(aria).toContain('Saldo negativo: -03h00');
  });

  it('6. monta a grade do mês com contagem correta de dias e slots', () => {
    const mockDays: MonthlyDaySummary[] = Array.from({ length: 30 }).map((_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      expectedMinutes: 480,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      status: 'NO_RECORDS',
      entries: [],
    }));

    const grid = buildSmartCalendarGrid(mockDays, '2026-11', TODAY_STR);
    expect(grid.year).toBe(2026);
    expect(grid.month).toBe(11);
    expect(grid.daysInMonth).toBe(30);
    expect(grid.leadInSlots).toBe(6);
    expect(grid.days.length).toBe(30);
    // 6 lead-in + 30 dias = 36 slots -> precisa de 6 lead-out slots para fechar a semana (42 total = 6 linhas de 7)
    expect(grid.leadOutSlots).toBe(6);
  });

  it('7. resposta parcial com dias ausentes não desloca os dias subsequentes da grade e classifica como DATA_UNAVAILABLE', () => {
    // Simula uma resposta parcial onde o dia 10 está ausente
    const partialDays: MonthlyDaySummary[] = [
      { date: '2026-11-09', expectedMinutes: 480, workedMinutes: 480, currentSessionMinutes: 0, totalWorkedMinutes: 480, balanceMinutes: 0, isOpen: false, status: 'RECORDED', entries: [] },
      // Dia 10 ausente
      { date: '2026-11-11', expectedMinutes: 480, workedMinutes: 480, currentSessionMinutes: 0, totalWorkedMinutes: 480, balanceMinutes: 0, isOpen: false, status: 'RECORDED', entries: [] },
    ];

    const grid = buildSmartCalendarGrid(partialDays, '2026-11', TODAY_STR);
    expect(grid.days.length).toBe(30);

    // O dia 10 continua na 10ª posição (índice 9), com status estrito DATA_UNAVAILABLE (NUNCA NO_RECORDS falso)
    expect(grid.days[9].dayNumber).toBe(10);
    expect(grid.days[9].summary.date).toBe('2026-11-10');
    expect(grid.days[9].summary.status).toBe('DATA_UNAVAILABLE');
    expect(grid.days[9].indicators.isDataUnavailable).toBe(true);
    expect(grid.days[9].indicators.isCompletedWorkday).toBe(false);
    expect(grid.days[9].indicators.isRestDay).toBe(false);
    expect(grid.days[9].ariaLabel).toContain('Dados indisponíveis');

    // O dia 11 NÃO é deslocado para a 10ª posição: fica estritamente na 11ª posição (índice 10)
    expect(grid.days[10].dayNumber).toBe(11);
    expect(grid.days[10].summary.date).toBe('2026-11-11');
    expect(grid.days[10].summary.totalWorkedMinutes).toBe(480);
  });

  it('8. deduplica dias repetidos e ignora dias pertencentes a outro mês', () => {
    const mixedDays: MonthlyDaySummary[] = [
      { date: '2026-11-05', expectedMinutes: 480, workedMinutes: 480, currentSessionMinutes: 0, totalWorkedMinutes: 480, balanceMinutes: 0, isOpen: false, status: 'RECORDED', entries: [] },
      // Duplicata do dia 05 com horário diferente
      { date: '2026-11-05', expectedMinutes: 480, workedMinutes: 300, currentSessionMinutes: 0, totalWorkedMinutes: 300, balanceMinutes: -180, isOpen: false, status: 'INCOMPLETE', entries: [] },
      // Dia de outubro inserido indevidamente
      { date: '2026-10-31', expectedMinutes: 480, workedMinutes: 480, currentSessionMinutes: 0, totalWorkedMinutes: 480, balanceMinutes: 0, isOpen: false, status: 'RECORDED', entries: [] },
      // Dia de dezembro inserido indevidamente
      { date: '2026-12-01', expectedMinutes: 480, workedMinutes: 480, currentSessionMinutes: 0, totalWorkedMinutes: 480, balanceMinutes: 0, isOpen: false, status: 'RECORDED', entries: [] },
    ];

    const grid = buildSmartCalendarGrid(mixedDays, '2026-11', TODAY_STR);
    expect(grid.days.length).toBe(30);

    // Dia 5 usa a primeira ocorrência (deduplicada)
    expect(grid.days[4].dayNumber).toBe(5);
    expect(grid.days[4].summary.totalWorkedMinutes).toBe(480);

    // Não contém 2026-10-31 nem 2026-12-01
    expect(grid.days.some((d) => d.summary.date === '2026-10-31')).toBe(false);
    expect(grid.days.some((d) => d.summary.date === '2026-12-01')).toBe(false);
  });
});

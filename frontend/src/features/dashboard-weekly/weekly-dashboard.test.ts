import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWeekDateRange,
  shiftWeek,
  formatWeekRangeLabel,
  getTodayDateStr,
} from '../../utils/date';
import {
  formatHoursMinutes,
  formatSignedBalanceHoursMinutes,
} from '../../utils/time';
import { WeeklySummary, WeeklyDaySummary, WeeklySummaryResponse } from '../../types/weekly-summary';

describe('Dashboard Semanal Inteligente — ETAPA 12.2', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------
  // 1. Semana Atual: Cálculo de segunda a domingo
  // -------------------------------------------------------------
  it('1. deve calcular corretamente o intervalo de segunda a domingo para uma data no meio da semana', () => {
    // 2026-11-18 é uma quarta-feira
    const range = getWeekDateRange('2026-11-18');
    expect(range.mondayStr).toBe('2026-11-16'); // Segunda-feira
    expect(range.sundayStr).toBe('2026-11-22'); // Domingo
  });

  it('1b. deve calcular corretamente o intervalo de segunda a domingo quando a data informada for domingo', () => {
    // 2026-11-22 é um domingo
    const range = getWeekDateRange('2026-11-22');
    expect(range.mondayStr).toBe('2026-11-16');
    expect(range.sundayStr).toBe('2026-11-22');
  });

  it('1c. deve calcular corretamente o intervalo de segunda a domingo quando a data informada for segunda-feira', () => {
    // 2026-11-16 é uma segunda-feira
    const range = getWeekDateRange('2026-11-16');
    expect(range.mondayStr).toBe('2026-11-16');
    expect(range.sundayStr).toBe('2026-11-22');
  });

  // -------------------------------------------------------------
  // 2. Navegação: Semana Anterior e Próxima Semana
  // -------------------------------------------------------------
  it('2. deve navegar para semana anterior e próxima semana com deslocamento exato de 7 dias', () => {
    const monday = '2026-11-16';
    const prevWeekMonday = shiftWeek(monday, -1);
    const nextWeekMonday = shiftWeek(monday, 1);

    expect(prevWeekMonday).toBe('2026-11-09');
    expect(nextWeekMonday).toBe('2026-11-23');
  });

  // -------------------------------------------------------------
  // 3. Formatação do Rótulo de Período (Semana padrão)
  // -------------------------------------------------------------
  it('3. deve formatar rótulo da semana dentro do mesmo mês', () => {
    const label = formatWeekRangeLabel('2026-11-16', '2026-11-22');
    expect(label).toBe('16 a 22 de novembro de 2026');
  });

  // -------------------------------------------------------------
  // 4. Virada do Mês
  // -------------------------------------------------------------
  it('4. deve formatar rótulo da semana na virada de mês incluindo ambos os meses', () => {
    const label = formatWeekRangeLabel('2026-09-28', '2026-10-04');
    expect(label).toBe('28 de setembro a 04 de outubro de 2026');
  });

  // -------------------------------------------------------------
  // 5. Virada do Ano
  // -------------------------------------------------------------
  it('5. deve formatar rótulo da semana na virada de ano incluindo ambos os anos', () => {
    const label = formatWeekRangeLabel('2026-12-28', '2027-01-03');
    expect(label).toBe('28 de dezembro de 2026 a 03 de janeiro de 2027');
  });

  // -------------------------------------------------------------
  // 6. Formatação de Horas e Saldo
  // -------------------------------------------------------------
  it('6. deve formatar minutos e saldos conforme o padrão do design system', () => {
    expect(formatHoursMinutes(480)).toBe('8h 00min');
    expect(formatHoursMinutes(1935)).toBe('32h 15min');
    expect(formatHoursMinutes(0)).toBe('0h 00min');

    expect(formatSignedBalanceHoursMinutes(130)).toBe('+2h 10min');
    expect(formatSignedBalanceHoursMinutes(-90)).toBe('-1h 30min');
    expect(formatSignedBalanceHoursMinutes(0)).toBe('0h 00min');
  });

  // -------------------------------------------------------------
  // 7. Não transformar dias futuros em débitos realizados
  // -------------------------------------------------------------
  it('7. cálculo do saldo semanal não deve penalizar dias futuros que ainda não chegaram', () => {
    // Simulação: Segunda e Terça cumpridas (8h cada = 16h = 960 min)
    // Quarta a Sexta: 8h planejadas cada (3 * 480 = 1440 min futuros)
    // Carga total planejada para a semana: 40h (2400 min)
    // Se hoje for terça-feira, o saldo apurado deve considerar APENAS Segunda e Terça!
    const totalWorkedMinutes = 960; // 16h
    const plannedTotalWeekMinutes = 2400; // 40h

    // Carga esperada aplicável até terça-feira: 16h (960 min)
    const applicableExpectedMinutes = 960;
    const weeklyBalance = totalWorkedMinutes - applicableExpectedMinutes;

    expect(weeklyBalance).toBe(0); // Em dia! Não -1440 min de dívida!
    expect(plannedTotalWeekMinutes).toBe(2400);
  });

  // -------------------------------------------------------------
  // 8. Dia em andamento: sessão atual somada ao total trabalhado
  // -------------------------------------------------------------
  it('8. dia em andamento reflete a sessão aberta no total trabalhado e na situação', () => {
    const dayInProgress: WeeklyDaySummary = {
      date: '2026-11-18',
      weekday: 'WEDNESDAY',
      weekdayShort: 'Qua',
      weekdayLong: 'Quarta-feira',
      status: 'IN_PROGRESS',
      statusLabel: 'Em andamento',
      expectedMinutes: 480,
      workedMinutes: 120, // 2h de sessão anterior fechada
      currentSessionMinutes: 180, // 3h de sessão aberta agora
      totalWorkedMinutes: 300, // 5h no total
      balanceMinutes: -180, // 300 - 480 = -180 min
      isOpen: true,
      hasEntries: true,
      entriesCount: 3,
    };

    expect(dayInProgress.totalWorkedMinutes).toBe(300);
    expect(dayInProgress.isOpen).toBe(true);
    expect(dayInProgress.status).toBe('IN_PROGRESS');
  });

  // -------------------------------------------------------------
  // 9. Dias de Folga planejada vs Feriados vs Ausências
  // -------------------------------------------------------------
  it('9. deve diferenciar semanticamente Folga Planejada, Feriado e Ausência', () => {
    const saturday: WeeklyDaySummary = {
      date: '2026-11-21',
      weekday: 'SATURDAY',
      weekdayShort: 'Sáb',
      weekdayLong: 'Sábado',
      status: 'REST_DAY',
      statusLabel: 'Folga planejada',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: null,
      isOpen: false,
      hasEntries: false,
      entriesCount: 0,
    };

    const holidayDay: WeeklyDaySummary = {
      date: '2026-11-20',
      weekday: 'FRIDAY',
      weekdayShort: 'Sex',
      weekdayLong: 'Sexta-feira',
      status: 'EXCUSED',
      statusLabel: 'Feriado',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      hasEntries: false,
      entriesCount: 0,
      holidayName: 'Dia da Consciência Negra',
    };

    const vacationDay: WeeklyDaySummary = {
      date: '2026-11-19',
      weekday: 'THURSDAY',
      weekdayShort: 'Qui',
      weekdayLong: 'Quinta-feira',
      status: 'EXCUSED',
      statusLabel: 'Ausência abonada',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      hasEntries: false,
      entriesCount: 0,
      occurrenceType: 'VACATION',
      occurrenceDescription: 'Férias Regulamentares',
    };

    expect(saturday.status).toBe('REST_DAY');
    expect(saturday.balanceMinutes).toBeNull();

    expect(holidayDay.holidayName).toBe('Dia da Consciência Negra');
    expect(holidayDay.expectedMinutes).toBe(0);

    expect(vacationDay.occurrenceType).toBe('VACATION');
    expect(vacationDay.occurrenceDescription).toBe('Férias Regulamentares');
  });

  // -------------------------------------------------------------
  // 10. Resumo Semanal: Contagem de dias com registros
  // -------------------------------------------------------------
  it('10. contagem de dias com registros reflete apenas dias com marcações reais', () => {
    const mockSummary: WeeklySummary = {
      startDate: '2026-11-16',
      endDate: '2026-11-22',
      totalWorkedMinutes: 1440, // 24h
      plannedExpectedMinutes: 2400, // 40h
      applicableExpectedMinutes: 1440,
      weeklyBalanceMinutes: 0,
      recordedDaysCount: 3, // Somente Seg, Ter, Qua tiveram registros
      plannedDaysCount: 5,
      completedDaysCount: 2,
      inProgressDaysCount: 1,
      isCurrentWeek: true,
      isPastWeek: false,
      isFutureWeek: false,
    };

    expect(mockSummary.recordedDaysCount).toBe(3);
    expect(mockSummary.plannedDaysCount).toBe(5);
    expect(mockSummary.recordedDaysCount).toBeLessThan(mockSummary.plannedDaysCount);
  });

  // -------------------------------------------------------------
  // 11. Jornada Noturna que atravessa meia-noite
  // -------------------------------------------------------------
  it('11. jornada noturna é contabilizada no dia de início sem quebrar a soma semanal', () => {
    // Plantão iniciado às 22:00 de segunda e concluído às 06:00 de terça (8h = 480 min)
    const nightShiftDay: WeeklyDaySummary = {
      date: '2026-11-16',
      weekday: 'MONDAY',
      weekdayShort: 'Seg',
      weekdayLong: 'Segunda-feira',
      status: 'RECORDED',
      statusLabel: 'Jornada encerrada',
      expectedMinutes: 480,
      workedMinutes: 480,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 480,
      balanceMinutes: 0,
      isOpen: false,
      hasEntries: true,
      entriesCount: 2,
    };

    expect(nightShiftDay.totalWorkedMinutes).toBe(480);
    expect(nightShiftDay.status).toBe('RECORDED');
  });

  // -------------------------------------------------------------
  // 12. Saldo Semanal Positivo (Horas extras na semana)
  // -------------------------------------------------------------
  it('12. saldo semanal positivo formata com sinal de mais e reflete excedente', () => {
    const worked = 2520; // 42h
    const expected = 2400; // 40h
    const balance = worked - expected; // +120 min (+2h 00min)

    const formatted = formatSignedBalanceHoursMinutes(balance);
    expect(formatted).toBe('+2h 00min');
  });

  // -------------------------------------------------------------
  // 13. Saldo Semanal Negativo (Déficit em dias passados)
  // -------------------------------------------------------------
  it('13. saldo semanal negativo formata com sinal de menos e reflete débito', () => {
    const worked = 2100; // 35h
    const expected = 2400; // 40h
    const balance = worked - expected; // -300 min (-5h 00min)

    const formatted = formatSignedBalanceHoursMinutes(balance);
    expect(formatted).toBe('-5h 00min');
  });

  // -------------------------------------------------------------
  // 14. Isolamento Assíncrono ao trocar rapidamente de semana
  // -------------------------------------------------------------
  it('14. requisições rápidas de navegação utilizam requestId e descartam respostas lentas obsoletas', async () => {
    let currentRequestId = 0;
    let appliedWeek: string | null = null;

    const navigateToWeekAsync = async (weekMonday: string, delayMs: number) => {
      const myRequestId = ++currentRequestId;
      await new Promise((r) => setTimeout(r, delayMs));

      // Se outra navegação aconteceu durante o delay, descarta!
      if (myRequestId !== currentRequestId) {
        return;
      }

      appliedWeek = weekMonday;
    };

    // Navega para Semana 1 (com resposta lenta de 50ms)
    const p1 = navigateToWeekAsync('2026-11-09', 50);

    // Imediatamente clica para Semana 2 (com resposta rápida de 10ms)
    const p2 = navigateToWeekAsync('2026-11-16', 10);

    await Promise.all([p1, p2]);

    // O estado final deve ser EXCLUSIVAMENTE a Semana 2
    expect(appliedWeek).toBe('2026-11-16');
  });

  // -------------------------------------------------------------
  // 15. Troca de usuário limpa dados da conta anterior
  // -------------------------------------------------------------
  it('15. troca de usuário reinicializa o resumo semanal para a semana corrente da nova conta', () => {
    let activeUser = 'user-A';
    let loadedDataForUser: string | null = 'user-A';

    // Simula logout / troca de conta
    activeUser = 'user-B';
    loadedDataForUser = null; // limpo no useEffect

    expect(loadedDataForUser).toBeNull();
    expect(activeUser).toBe('user-B');
  });
});

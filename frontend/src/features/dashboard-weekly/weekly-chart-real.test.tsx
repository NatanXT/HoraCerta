// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { WeeklyChart } from '../../components/dashboard/weekly/WeeklyChart';
import { WeeklyDaySummary } from '../../types/weekly-summary';

describe('WeeklyChart — Real DOM Rendering Suite', () => {
  afterEach(() => {
    cleanup();
  });
  const createDay = (overrides: Partial<WeeklyDaySummary>): WeeklyDaySummary => ({
    date: '2026-11-16',
    weekday: 'MONDAY',
    weekdayShort: 'Seg',
    weekdayLong: 'Segunda-feira',
    status: 'RECORDED',
    statusLabel: 'Encerrada',
    expectedMinutes: 480,
    workedMinutes: 480,
    currentSessionMinutes: 0,
    totalWorkedMinutes: 480,
    balanceMinutes: 0,
    isOpen: false,
    hasEntries: true,
    entriesCount: 2,
    holidayName: null,
    occurrenceType: null,
    occurrenceDescription: null,
    ...overrides,
  });

  // 1. Folga sem trabalho
  it('1. renderiza folga sem trabalho como "Folga planejada" com previsto "Folga" e sem barra', () => {
    const days = [
      createDay({
        date: '2026-11-15',
        expectedMinutes: 0,
        workedMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: null,
        hasEntries: false,
        status: 'REST_DAY',
        statusLabel: 'Folga planejada',
      }),
    ];

    const { getByText } = render(<WeeklyChart days={days} />);

    expect(getByText('Folga planejada')).toBeDefined();
    expect(getByText('Folga')).toBeDefined();
    expect(getByText('0h 00min')).toBeDefined();
  });

  // 2. Folga com trabalho (trabalho extraordinário)
  it('2. renderiza folga com trabalho como "Trabalho em folga", exibindo horas trabalhadas e texto "Sem meta planejada"', () => {
    const days = [
      createDay({
        date: '2026-11-21',
        weekdayShort: 'Sáb',
        expectedMinutes: 0,
        workedMinutes: 240, // 4h
        totalWorkedMinutes: 240,
        balanceMinutes: 240,
        hasEntries: true,
        status: 'RECORDED',
      }),
    ];

    const { getByText } = render(<WeeklyChart days={days} />);

    expect(getByText('Trabalho em folga')).toBeDefined();
    expect(getByText('Sem meta planejada')).toBeDefined();
    expect(getByText('4h 00min')).toBeDefined();
    expect(getByText('+4h 00min')).toBeDefined();
  });

  // 3. Feriado sem trabalho
  it('3. renderiza feriado sem trabalho exibindo nome do feriado e carga prevista "Feriado"', () => {
    const days = [
      createDay({
        date: '2026-11-20',
        holidayName: 'Dia da Consciência Negra',
        expectedMinutes: 0,
        workedMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: null,
        hasEntries: false,
        status: 'EXCUSED',
      }),
    ];

    const { getByText } = render(<WeeklyChart days={days} />);

    expect(getByText('Dia da Consciência Negra')).toBeDefined();
    expect(getByText('Feriado')).toBeDefined();
    expect(getByText('0h 00min')).toBeDefined();
  });

  // 4. Feriado com trabalho
  it('4. renderiza feriado com trabalho sem esconder o feriado e indicando que foi trabalhado', () => {
    const days = [
      createDay({
        date: '2026-11-20',
        holidayName: 'Consciência Negra',
        expectedMinutes: 0,
        workedMinutes: 300, // 5h
        totalWorkedMinutes: 300,
        balanceMinutes: 300,
        hasEntries: true,
        status: 'RECORDED',
      }),
    ];

    const { getByText } = render(<WeeklyChart days={days} />);

    // Confirma que exibe o nome do feriado com indicação de trabalhado
    expect(getByText('Consciência Negra (Trabalhado)')).toBeDefined();
    expect(getByText('5h 00min')).toBeDefined();
    expect(getByText('+5h 00min')).toBeDefined();
    expect(getByText('Sem meta planejada')).toBeDefined();
  });

  // 5. Ausência abonada
  it('5. renderiza ausência abonada exibindo descrição e carga prevista "Ausência"', () => {
    const days = [
      createDay({
        date: '2026-11-17',
        occurrenceType: 'SICK_LEAVE',
        occurrenceDescription: 'Licença Médica',
        expectedMinutes: 0,
        workedMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: null,
        hasEntries: false,
        status: 'EXCUSED',
      }),
    ];

    const { getAllByText, getByText } = render(<WeeklyChart days={days} />);

    expect(getAllByText('Licença Médica').length).toBeGreaterThanOrEqual(1);
    expect(getByText('0h 00min')).toBeDefined();
  });

  // 6. Jornada normal em andamento
  it('6. renderiza jornada normal em andamento com badge "Em andamento" e pulse ativo', () => {
    const days = [
      createDay({
        date: '2026-11-16',
        expectedMinutes: 480,
        workedMinutes: 180,
        totalWorkedMinutes: 180,
        balanceMinutes: -300,
        isOpen: true,
        status: 'IN_PROGRESS',
      }),
    ];

    const { getByText } = render(<WeeklyChart days={days} />);

    expect(getByText('Em andamento')).toBeDefined();
    expect(getByText('3h 00min')).toBeDefined();
    expect(getByText('8h 00min')).toBeDefined();
    expect(getByText('-5h 00min')).toBeDefined();
  });

  // 7. Jornada normal encerrada
  it('7. renderiza jornada normal encerrada com badge "Encerrada" e saldo calculado', () => {
    const days = [
      createDay({
        date: '2026-11-16',
        expectedMinutes: 480,
        workedMinutes: 510,
        totalWorkedMinutes: 510,
        balanceMinutes: 30,
        isOpen: false,
        status: 'RECORDED',
      }),
    ];

    const { getByText } = render(<WeeklyChart days={days} />);

    expect(getByText('Encerrada')).toBeDefined();
    expect(getByText('8h 30min')).toBeDefined();
    expect(getByText('8h 00min')).toBeDefined();
    expect(getByText('+0h 30min')).toBeDefined();
  });
});

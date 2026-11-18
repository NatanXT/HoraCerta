// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { DayTooltipContent } from './DayTooltipContent';
import { MonthlyDaySummary } from '../../types/work-day';

describe('DayTooltipContent — Renderização e Isolamento de Estados', () => {
  afterEach(() => {
    cleanup();
  });

  it('1. Dia indisponível (DATA_UNAVAILABLE): exibe aviso de indisponibilidade e NÃO renderiza 00h00, saldo ou métricas', () => {
    const unavailableDay: MonthlyDaySummary = {
      date: '2026-11-10',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: null,
      isOpen: false,
      status: 'DATA_UNAVAILABLE',
      entries: [],
    };

    render(<DayTooltipContent day={unavailableDay} />);

    // Deve exibir data civil e badge de indisponível
    expect(screen.getByText(/10\/11\/2026/)).toBeDefined();
    expect(screen.getByText('Dados indisponíveis')).toBeDefined();
    expect(
      screen.getByText('Os registros e jornada deste dia não foram fornecidos pelo servidor.')
    ).toBeDefined();

    // NÃO deve exibir 00h00, jornada prevista, saldo ou trabalhado
    expect(screen.queryByText(/00h00/)).toBeNull();
    expect(screen.queryByText(/Jornada prevista/i)).toBeNull();
    expect(screen.queryByText(/Trabalhado/i)).toBeNull();
    expect(screen.queryByText(/Saldo/i)).toBeNull();
  });

  it('2. Dia sem registros confirmado pelo backend (NO_RECORDS): exibe jornada prevista e status sem registros', () => {
    const noRecordsDay: MonthlyDaySummary = {
      date: '2026-11-04',
      expectedMinutes: 480,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      status: 'NO_RECORDS',
      entries: [],
    };

    render(<DayTooltipContent day={noRecordsDay} />);

    expect(screen.getByText(/04\/11\/2026/)).toBeDefined();
    expect(screen.getByText('Sem registro')).toBeDefined();
    expect(screen.getByText('Jornada prevista')).toBeDefined();
    expect(screen.getByText('08h00')).toBeDefined();
  });

  it('3. Dia com jornada concluída (RECORDED): exibe horas trabalhadas e contagem de batidas', () => {
    const recordedDay: MonthlyDaySummary = {
      date: '2026-11-05',
      expectedMinutes: 480,
      workedMinutes: 480,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 480,
      balanceMinutes: 0,
      isOpen: false,
      status: 'RECORDED',
      entries: [
        { id: 'e1', type: 'CLOCK_IN', timestamp: '2026-11-05T08:00:00Z' },
        { id: 'e2', type: 'CLOCK_OUT', timestamp: '2026-11-05T17:00:00Z' },
      ],
    };

    render(<DayTooltipContent day={recordedDay} />);

    expect(screen.getByText('Registrado')).toBeDefined();
    expect(screen.getByText('Trabalhado')).toBeDefined();
    expect(screen.getAllByText('08h00').length).toBeGreaterThan(0);
    expect(screen.getByText('2 batidas')).toBeDefined();
  });

  it('4. Dia com saldo positivo e dia com saldo negativo: exibe sinais e valores corretos', () => {
    const positiveDay: MonthlyDaySummary = {
      date: '2026-11-06',
      expectedMinutes: 480,
      workedMinutes: 510,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 510,
      balanceMinutes: 30,
      isOpen: false,
      status: 'RECORDED',
      entries: [],
    };

    const { unmount } = render(<DayTooltipContent day={positiveDay} />);
    expect(screen.getByText('+00h30')).toBeDefined();
    unmount();

    const negativeDay: MonthlyDaySummary = {
      date: '2026-11-07',
      expectedMinutes: 480,
      workedMinutes: 420,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 420,
      balanceMinutes: -60,
      isOpen: false,
      status: 'RECORDED',
      entries: [],
    };

    render(<DayTooltipContent day={negativeDay} />);
    expect(screen.getByText('-01h00')).toBeDefined();
  });

  it('5. Feriado Nacional: exibe rótulo oficial "Feriado Nacional" e nome do feriado', () => {
    const nationalHolidayDay: MonthlyDaySummary = {
      date: '2026-11-15',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      status: 'EXCUSED',
      entries: [],
      holiday: {
        id: 'h-nat',
        date: '2026-11-15',
        name: 'Proclamação da República',
        type: 'national',
        source: 'BRASIL_API',
      },
    };

    render(<DayTooltipContent day={nationalHolidayDay} />);
    expect(screen.getByText('Feriado Nacional')).toBeDefined();
    expect(screen.getByText('Proclamação da República')).toBeDefined();
  });

  it('6. Feriado Estadual: exibe rótulo oficial "Feriado Estadual" e nome do feriado', () => {
    const stateHolidayDay: MonthlyDaySummary = {
      date: '2026-07-09',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      status: 'EXCUSED',
      entries: [],
      holiday: {
        id: 'h-state',
        date: '2026-07-09',
        name: 'Revolução Constitucionalista',
        type: 'state',
        source: 'BRASIL_API',
      },
    };

    render(<DayTooltipContent day={stateHolidayDay} />);
    expect(screen.getByText('Feriado Estadual')).toBeDefined();
    expect(screen.getByText('Revolução Constitucionalista')).toBeDefined();
  });

  it('7. Feriado Municipal: exibe rótulo oficial "Feriado Municipal" e nome do feriado', () => {
    const municipalHolidayDay: MonthlyDaySummary = {
      date: '2026-01-25',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      status: 'EXCUSED',
      entries: [],
      holiday: {
        id: 'h-muni',
        date: '2026-01-25',
        name: 'Aniversário de São Paulo',
        type: 'municipal',
        source: 'BRASIL_API',
      },
    };

    render(<DayTooltipContent day={municipalHolidayDay} />);
    expect(screen.getByText('Feriado Municipal')).toBeDefined();
    expect(screen.getByText('Aniversário de São Paulo')).toBeDefined();
  });

  it('8. Feriado sem tipo informado: adota fallback oficial "Feriado Nacional"', () => {
    const defaultHolidayDay: MonthlyDaySummary = {
      date: '2026-12-25',
      expectedMinutes: 0,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: 0,
      isOpen: false,
      status: 'EXCUSED',
      entries: [],
      holiday: {
        id: 'h-def',
        date: '2026-12-25',
        name: 'Natal',
        source: 'BRASIL_API',
      },
    };

    render(<DayTooltipContent day={defaultHolidayDay} />);
    expect(screen.getByText('Feriado Nacional')).toBeDefined();
    expect(screen.getByText('Natal')).toBeDefined();
  });
});

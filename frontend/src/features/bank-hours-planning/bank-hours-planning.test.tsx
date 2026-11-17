// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react';
import React from 'react';
import { BankHoursPlanningCard } from './BankHoursPlanningCard';
import { useBankHoursPlanning } from './useBankHoursPlanning';
import { useAuth } from '../../contexts/AuthContext';
import { settingsService } from '../../services/settings.service';
import { holidayService } from '../../services/holiday.service';
import { calendarOccurrenceService } from '../../services/calendar-occurrence.service';
import { api } from '../../services/api';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/settings.service', () => ({
  settingsService: {
    getSettings: vi.fn(),
  },
}));

vi.mock('../../services/holiday.service', () => ({
  holidayService: {
    getHolidays: vi.fn(),
  },
}));

vi.mock('../../services/calendar-occurrence.service', () => ({
  calendarOccurrenceService: {
    getOccurrences: vi.fn(),
  },
}));

describe('BankHoursPlanningCard — Integration and UI Suite (ETAPA 12.4.1)', () => {
  const MOCK_USER = { id: 'user_123', name: 'Colaborador Teste' };
  const TODAY_STR = '2026-11-15'; // Domingo

  const mockSettings = {
    profile: { name: 'Colaborador Teste', email: 'teste@horacerta.local' },
    preferences: { timezone: 'America/Sao_Paulo' },
    workSchedule: {
      effectiveFrom: '2026-01-01',
      weeklyExpectedMinutes: 2400,
      days: [
        { weekday: 'MONDAY', expectedMinutes: 480 },
        { weekday: 'TUESDAY', expectedMinutes: 480 },
        { weekday: 'WEDNESDAY', expectedMinutes: 480 },
        { weekday: 'THURSDAY', expectedMinutes: 480 },
        { weekday: 'FRIDAY', expectedMinutes: 480 },
        { weekday: 'SATURDAY', expectedMinutes: 0 },
        { weekday: 'SUNDAY', expectedMinutes: 0 },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: MOCK_USER,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    });

    (settingsService.getSettings as any).mockResolvedValue(mockSettings);
    (holidayService.getHolidays as any).mockResolvedValue([]);
    (calendarOccurrenceService.getOccurrences as any).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('1. renderiza título, badge de simulação e exibe saldo oficial atual corretamente', async () => {
    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-360} // -06h 00min
        todayStr={TODAY_STR}
      />
    );

    expect(screen.getByText('Planejamento de compensação')).toBeDefined();
    expect(screen.getByText('SIMULAÇÃO')).toBeDefined();
    expect(screen.getByText('Saldo oficial atual:')).toBeDefined();
    expect(screen.getByText('-06h00')).toBeDefined();
    expect(
      screen.getByText('Simulação informativa — não altera seus registros de ponto ou saldo oficial.')
    ).toBeDefined();

    await waitFor(() => {
      expect(settingsService.getSettings).toHaveBeenCalled();
    });
  });

  it('2. destaca débito atual a recuperar quando saldo for negativo e saldo positivo quando for positivo', async () => {
    const { rerender } = render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-180} // -03h 00min
        todayStr={TODAY_STR}
      />
    );

    expect(screen.getAllByText(/3h 00min/).length).toBeGreaterThan(0);
    expect(screen.getByText(/débito a recuperar no banco de horas/)).toBeDefined();

    rerender(
      <BankHoursPlanningCard
        currentBalanceMinutes={120} // +02h 00min
        todayStr={TODAY_STR}
      />
    );

    expect(screen.getByText(/Não existe débito atual a recuperar/)).toBeDefined();
    expect(screen.getByText('Saldo atual positivo')).toBeDefined();
  });

  it('3. não exibe números projetados antes do calendário estar disponível (estado de carregamento)', async () => {
    // Retém resposta de settings em Promise pendente
    let resolveSettings: any;
    (settingsService.getSettings as any).mockImplementation(
      () =>
        new Promise((res) => {
          resolveSettings = res;
        })
    );

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-300}
        todayStr={TODAY_STR}
      />
    );

    // Deve exibir estado de loading
    expect(screen.getByText(/Consultando expediente, feriados e ausências/)).toBeDefined();
    // NÃO deve exibir o bloco de resultados com valores calculados
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();

    // Conclui o carregamento
    resolveSettings(mockSettings);
    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });
  });

  it('4. falha ao carregar settings resulta em estado de erro e impede projeção calculada', async () => {
    (settingsService.getSettings as any).mockRejectedValue(new Error('Network error on settings'));

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-240}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Não foi possível carregar a configuração de expediente/)
      ).toBeDefined();
    });

    expect(screen.getByText('Tentar novamente')).toBeDefined();
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();
  });

  it('5. falha ao carregar feriados não assume que não há feriados e bloqueia projeção', async () => {
    (holidayService.getHolidays as any).mockRejectedValue(new Error('Holidays API offline'));

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-240}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Não foi possível carregar a relação de feriados/)
      ).toBeDefined();
    });

    expect(screen.getByText('Tentar novamente')).toBeDefined();
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();
  });

  it('6. falha ao carregar ausências não assume que não há ausências e bloqueia projeção', async () => {
    (calendarOccurrenceService.getOccurrences as any).mockRejectedValue(
      new Error('Occurrences API 500')
    );

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-240}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Não foi possível carregar as ausências cadastradas/)
      ).toBeDefined();
    });

    expect(screen.getByText('Tentar novamente')).toBeDefined();
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();
  });

  it('7. resposta válida com listas vazias é aceita e calcula projeção corretamente', async () => {
    (holidayService.getHolidays as any).mockResolvedValue([]);
    (calendarOccurrenceService.getOccurrences as any).mockResolvedValue([]);

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-300}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });

    expect(screen.queryByText(/Não foi possível/)).toBeNull();
  });

  it('8. ação Tentar Novamente recupera o calendário após falha', async () => {
    (holidayService.getHolidays as any).mockRejectedValueOnce(new Error('Temporary 503'));

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-180}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tentar novamente')).toBeDefined();
    });

    // Corrige mock para próxima chamada
    (holidayService.getHolidays as any).mockResolvedValue([]);

    fireEvent.click(screen.getByText('Tentar novamente'));

    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });
  });

  it('9. input de meta inválido bloqueia a projeção e exibe mensagem de validação sem usar valor antigo', async () => {
    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-300}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });

    const targetInput = screen.getByLabelText(/Meta de saldo desejada/);
    fireEvent.change(targetInput, { target: { value: 'texto_invalido' } });

    // Erro de formato deve ser exibido
    expect(screen.getByText(/Formato de meta de saldo inválido/)).toBeDefined();
    expect(screen.getByText(/Informe uma meta de saldo válida/)).toBeDefined();
    // Bloco de resultados não deve exibir valores antigos como válidos
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();

    // Corrige para formato válido
    fireEvent.change(targetInput, { target: { value: '+02:00' } });
    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });
  });

  it('10. alternância entre Modo A e Modo B com botões rápidos e validação de limite', async () => {
    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-180}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });

    const modeBButton = screen.getByText('Modo B: Acréscimo fixo por dia');
    fireEvent.click(modeBButton);

    expect(screen.getByText('+15m')).toBeDefined();
    expect(screen.getByText('+30m')).toBeDefined();
    expect(screen.getByText('+45m')).toBeDefined();
    expect(screen.getByText('+60m')).toBeDefined();

    fireEvent.click(screen.getByText('+45m'));
    expect(screen.getByText('+45 min/dia')).toBeDefined();
  });

  it('11. isolamento entre contas e descarte de requisição atrasada na troca de usuário (ETAPA 12.4.2)', async () => {
    // Usuário A possui jornada padrão de 5 dias úteis (Seg-Sex 8h = 22 dias no período)
    let resolveUserASettings: any;
    (settingsService.getSettings as any).mockImplementation(
      () =>
        new Promise((res) => {
          resolveUserASettings = res;
        })
    );

    (useAuth as any).mockReturnValue({
      user: { id: 'user_A', name: 'Usuário A' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    });

    const { rerender } = render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-240}
        todayStr={TODAY_STR}
      />
    );

    // Usuário A está aguardando resposta
    expect(screen.getByText(/Consultando expediente, feriados e ausências/)).toBeDefined();

    // Troca para Usuário B que trabalha apenas 2 dias na semana (Terça e Quinta)
    const userBSchedule = [
      { weekday: 'MONDAY', expectedMinutes: 0 },
      { weekday: 'TUESDAY', expectedMinutes: 480 },
      { weekday: 'WEDNESDAY', expectedMinutes: 0 },
      { weekday: 'THURSDAY', expectedMinutes: 480 },
      { weekday: 'FRIDAY', expectedMinutes: 0 },
      { weekday: 'SATURDAY', expectedMinutes: 0 },
      { weekday: 'SUNDAY', expectedMinutes: 0 },
    ];

    (settingsService.getSettings as any).mockResolvedValue({
      ...mockSettings,
      workSchedule: {
        ...mockSettings.workSchedule,
        days: userBSchedule,
      },
    });

    (useAuth as any).mockReturnValue({
      user: { id: 'user_B', name: 'Usuário B' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    });

    rerender(
      <BankHoursPlanningCard
        currentBalanceMinutes={-180}
        todayStr={TODAY_STR}
      />
    );

    // Aguarda Usuário B carregar completamente seu expediente de 2 dias/semana
    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });

    // Abre o detalhamento de calendário para inspecionar os dias elegíveis
    fireEvent.click(screen.getByText(/Detalhamento do calendário/));
    expect(screen.getByText('9 dias')).toBeDefined(); // Usuário B tem exatamente 9 dias (Ter/Qui)

    // Resposta atrasada do Usuário A chega agora (com jornada de 5 dias/semana)
    resolveUserASettings(mockSettings);

    // A resposta tardia do Usuário A NÃO pode sobrescrever os dados do Usuário B
    await new Promise((r) => setTimeout(r, 50));

    // Permanece com os 9 dias do Usuário B e o saldo oficial do Usuário B
    expect(screen.getByText('9 dias')).toBeDefined();
    expect(screen.queryByText('22 dias')).toBeNull();
    expect(screen.getByText('-03h00')).toBeDefined();
  });

  it('12. limpeza completa de dados de calendário ao efetuar logout', async () => {
    const { rerender } = render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-120}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });

    // Simula logout: user = null
    (useAuth as any).mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    });

    rerender(
      <BankHoursPlanningCard
        currentBalanceMinutes={-120}
        todayStr={TODAY_STR}
      />
    );

    // Não deve exibir resultados calculados sem usuário autenticado
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();
  });

  it('13. comprovação de ausência de escritas na API (POST, PUT, PATCH, DELETE)', async () => {
    // Spies reais diretamente nos métodos da instância Axios `api`
    const postSpy = vi.spyOn(api, 'post');
    const putSpy = vi.spyOn(api, 'put');
    const patchSpy = vi.spyOn(api, 'patch');
    const deleteSpy = vi.spyOn(api, 'delete');

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-300}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });

    // Interações completas com todos os controles do card
    const targetInput = screen.getByLabelText(/Meta de saldo desejada/);
    fireEvent.change(targetInput, { target: { value: '+03:00' } });

    const modeBButton = screen.getByText('Modo B: Acréscimo fixo por dia');
    fireEvent.click(modeBButton);

    fireEvent.click(screen.getByText('+60m'));

    const detailsButton = screen.getByText(/Detalhamento do calendário/);
    fireEvent.click(detailsButton);

    // Garante categoricamente que NENHUMA chamada de mutação foi disparada
    expect(postSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('14. atualização de saldo oficial em tempo real preserva meta, prazo e simulação sem piscar loading nem refazer queries (ETAPA 12.4.2)', async () => {
    // 1. Montar a simulação com saldo inicial de -120 min (-02h00)
    const { result, rerender } = renderHook(
      ({ balance, today }: { balance: number; today: string }) =>
        useBankHoursPlanning({
          currentBalanceMinutes: balance,
          todayStr: today,
        }),
      {
        initialProps: {
          balance: -120,
          today: TODAY_STR,
        },
      }
    );

    // 2. Aguardar o carregamento inicial do calendário
    await waitFor(() => {
      expect(result.current.calendarStatus).toBe('ready');
    });

    // 3. Modificar efetivamente a meta para +02:00 (120 minutos)
    act(() => {
      result.current.setTargetBalanceInput('+02:00');
    });
    expect(result.current.targetBalanceInput).toBe('+02:00');
    expect(result.current.targetBalanceMinutes).toBe(120);

    // 4. Modificar efetivamente o prazo selecionado para 2026-12-24
    act(() => {
      result.current.setTargetDateStr('2026-12-24');
    });

    // Aguarda atualização do calendário para o novo prazo selecionado
    await waitFor(() => {
      expect(result.current.calendarStatus).toBe('ready');
      expect(result.current.targetDateStr).toBe('2026-12-24');
    });

    // 5. Registrar os valores numéricos da projeção inicial antes da alteração de saldo
    const initialMinutesToCompensate = result.current.simulationResult.minutesToCompensate;
    const initialDailyMinutes = result.current.simulationResult.suggestedDailyMinutes;
    const initialProjectedBalance = result.current.simulationResult.projectedBalanceModeA;
    const eligibleDaysCount = result.current.simulationResult.breakdown.eligibleDaysCount;

    // Garante que a projeção inicial calculou valores reais consistentes
    expect(initialMinutesToCompensate).toBe(240); // 120 - (-120) = 240 minutos a compensar
    expect(eligibleDaysCount).toBeGreaterThan(0);
    expect(initialDailyMinutes).toBe(Math.ceil(240 / eligibleDaysCount));
    expect(initialProjectedBalance).toBe(-120 + initialDailyMinutes * eligibleDaysCount);

    // Limpa espiões para monitorar rigorosamente qualquer chamada HTTP subsequente
    vi.clearAllMocks();

    // 6. Atualizar currentBalanceMinutes na mesma conta (ex: saldo reduz débito para -60 min)
    rerender({
      balance: -60,
      today: TODAY_STR,
    });

    // 7. Confirmar a preservação da meta customizada e do prazo selecionado
    expect(result.current.targetBalanceInput).toBe('+02:00');
    expect(result.current.targetBalanceMinutes).toBe(120);
    expect(result.current.targetDateStr).toBe('2026-12-24');

    // 8. Confirmar que os valores projetados foram recalculados corretamente de forma reativa
    const newMinutesToCompensate = result.current.simulationResult.minutesToCompensate;
    const newDailyMinutes = result.current.simulationResult.suggestedDailyMinutes;
    const newProjectedBalance = result.current.simulationResult.projectedBalanceModeA;

    expect(result.current.simulationResult.currentBalanceMinutes).toBe(-60);
    expect(newMinutesToCompensate).toBe(180); // 120 - (-60) = 180 minutos
    expect(newMinutesToCompensate).not.toBe(initialMinutesToCompensate);

    expect(newDailyMinutes).toBe(Math.ceil(180 / eligibleDaysCount));
    expect(newDailyMinutes).not.toBe(initialDailyMinutes);

    expect(newProjectedBalance).toBe(-60 + newDailyMinutes * eligibleDaysCount);

    // 9. Confirmar ausência de novas consultas desnecessárias
    expect(settingsService.getSettings).not.toHaveBeenCalled();
    expect(holidayService.getHolidays).not.toHaveBeenCalled();
    expect(calendarOccurrenceService.getOccurrences).not.toHaveBeenCalled();

    // 10. Confirmar ausência de loading (estado permanece 'ready' sem interrupção)
    expect(result.current.calendarStatus).toBe('ready');
    expect(result.current.loadingCalendar).toBe(false);
  });

  it('15. transição de saldo negativo para positivo preserva customizações e atualiza simulação (ETAPA 12.4.2)', async () => {
    const { rerender } = render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-60}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Resultado da Simulação')).toBeDefined();
    });

    const targetInput = screen.getByLabelText(/Meta de saldo desejada/) as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: '+03:00' } });
    expect(targetInput.value).toBe('+03:00');

    // Transição de saldo para positivo (+60 = +01h00)
    rerender(
      <BankHoursPlanningCard
        currentBalanceMinutes={60}
        todayStr={TODAY_STR}
      />
    );

    // Exibe saldo positivo
    expect(screen.getByText('+01h00')).toBeDefined();
    // Meta permanece intacta
    expect(targetInput.value).toBe('+03:00');
    // Não pisca loading
    expect(screen.queryByText(/Consultando expediente/)).toBeNull();
  });

  it('16. expediente semanal incompleto (ex: 6 dias) exibe erro e suspende cálculo (ETAPA 12.4.2)', async () => {
    (settingsService.getSettings as any).mockResolvedValue({
      ...mockSettings,
      workSchedule: {
        ...mockSettings.workSchedule,
        days: [
          { weekday: 'MONDAY', expectedMinutes: 480 },
          { weekday: 'TUESDAY', expectedMinutes: 480 },
          { weekday: 'WEDNESDAY', expectedMinutes: 480 },
          { weekday: 'THURSDAY', expectedMinutes: 480 },
          { weekday: 'FRIDAY', expectedMinutes: 480 },
          { weekday: 'SATURDAY', expectedMinutes: 0 },
          // Faltando SUNDAY propositalmente
        ],
      },
    });

    render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-120}
        todayStr={TODAY_STR}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Configuração de expediente incompleta ou inválida/i)
      ).toBeDefined();
    });

    // Não deve exibir resultados calculados fictícios
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();
  });

  it('17. logout durante consulta pendente é tratado com segurança sem erro (ETAPA 12.4.2)', async () => {
    let pendingResolve: any;
    (settingsService.getSettings as any).mockImplementation(
      () =>
        new Promise((res) => {
          pendingResolve = res;
        })
    );

    const { rerender } = render(
      <BankHoursPlanningCard
        currentBalanceMinutes={-120}
        todayStr={TODAY_STR}
      />
    );

    expect(screen.getByText(/Consultando expediente, feriados e ausências/)).toBeDefined();

    // Usuário desloga antes da resposta
    (useAuth as any).mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    });

    rerender(
      <BankHoursPlanningCard
        currentBalanceMinutes={-120}
        todayStr={TODAY_STR}
      />
    );

    // Resposta chega após logout
    pendingResolve(mockSettings);
    await new Promise((r) => setTimeout(r, 50));

    // Nenhuma exceção lançada e nenhum resultado fictício renderizado
    expect(screen.queryByText('Resultado da Simulação')).toBeNull();
  });
});

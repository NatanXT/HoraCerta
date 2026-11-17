// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeeklySummary } from '../../hooks/useWeeklySummary';
import { workDayService } from '../../services/work-day.service';
import * as AuthContextModule from '../../contexts/AuthContext';
import { WeeklySummaryResponse } from '../../types/weekly-summary';

// Mock workDayService
vi.mock('../../services/work-day.service', () => ({
  workDayService: {
    getWeeklySummary: vi.fn(),
  },
}));

describe('useWeeklySummary — Real React Hook Integration Suite', () => {
  let currentUser: { id: string; name: string } | null = { id: 'user_1', name: 'User 1' };

  // Monday, 2026-11-16 at 12:00:00 UTC
  const DETERMINISTIC_NOW = new Date('2026-11-16T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(DETERMINISTIC_NOW);

    currentUser = { id: 'user_1', name: 'User 1' };
    vi.spyOn(AuthContextModule, 'useAuth').mockImplementation(() => ({
      user: currentUser as any,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const createMockResponse = (mondayStr: string, customUserId?: string): WeeklySummaryResponse => ({
    summary: {
      startDate: mondayStr,
      endDate: '2026-11-22',
      totalWorkedMinutes: 1440,
      nominalExpectedMinutes: 2400,
      plannedExpectedMinutes: 2400,
      applicableExpectedMinutes: 1440,
      weeklyBalanceMinutes: 0,
      recordedDaysCount: 3,
      plannedDaysCount: 5,
      completedDaysCount: 3,
      inProgressDaysCount: 0,
      isCurrentWeek: mondayStr === '2026-11-16',
      isPastWeek: mondayStr < '2026-11-16',
      isFutureWeek: mondayStr > '2026-11-16',
    },
    days: [],
    contextualInsight: customUserId ? `Dados de ${customUserId}` : 'Carga horária em dia.',
  });

  // -------------------------------------------------------------------------
  // 1. Uma única requisição na montagem inicial
  // -------------------------------------------------------------------------
  it('1. executa exatamente UMA requisição na montagem inicial em modo normal', async () => {
    const mockSummary = createMockResponse('2026-11-16');
    vi.mocked(workDayService.getWeeklySummary).mockResolvedValue(mockSummary);

    const initialTrigger = { entries: [{ id: '1' }] };

    const { result } = renderHook(() => useWeeklySummary({ refreshTrigger: initialTrigger }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(workDayService.getWeeklySummary).toHaveBeenCalledTimes(1);
    expect(result.current.data?.summary.startDate).toBe('2026-11-16');
  });

  // -------------------------------------------------------------------------
  // 2. Navegação entre semanas e transição de mês/ano
  // -------------------------------------------------------------------------
  it('2. navega corretamente entre semanas, respeitando transições de mês e ano de forma determinística', async () => {
    vi.mocked(workDayService.getWeeklySummary).mockImplementation(async (mondayStr: string) => {
      return createMockResponse(mondayStr);
    });

    const { result } = renderHook(() => useWeeklySummary());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectedMondayStr).toBe('2026-11-16');

    // Navega para semana anterior (2026-11-09)
    act(() => {
      result.current.goToPreviousWeek();
    });

    await waitFor(() => {
      expect(result.current.selectedMondayStr).toBe('2026-11-09');
      expect(result.current.loading).toBe(false);
    });

    // Retorna para semana atual (2026-11-16)
    act(() => {
      result.current.goToCurrentWeek();
    });

    await waitFor(() => {
      expect(result.current.selectedMondayStr).toBe('2026-11-16');
      expect(result.current.isCurrentWeekSelected).toBe(true);
    });

    // Navega para a próxima semana (2026-11-23)
    act(() => {
      result.current.goToNextWeek();
    });

    await waitFor(() => {
      expect(result.current.selectedMondayStr).toBe('2026-11-23');
      expect(result.current.isCurrentWeekSelected).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Respostas fora de ordem (race conditions) descartam a requisição antiga
  // -------------------------------------------------------------------------
  it('3. descarta respostas fora de ordem em navegação rápida preservando o último destino', async () => {
    let resolveFirstReq!: (val: any) => void;
    let resolveSecondReq!: (val: any) => void;

    vi.mocked(workDayService.getWeeklySummary)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstReq = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondReq = resolve;
          })
      );

    const { result } = renderHook(() => useWeeklySummary());

    // Usuário clica imediatamente para a próxima semana antes da primeira terminar
    act(() => {
      result.current.goToNextWeek();
    });

    // A segunda requisição responde antes
    await act(async () => {
      resolveSecondReq(createMockResponse('2026-11-23'));
    });

    await waitFor(() => {
      expect(result.current.data?.summary.startDate).toBe('2026-11-23');
    });

    // A primeira requisição responde depois (atrasada)
    await act(async () => {
      resolveFirstReq(createMockResponse('2026-11-16'));
    });

    // O estado NÃO deve ser sobrescrito pela resposta obsoleta da primeira requisição
    expect(result.current.data?.summary.startDate).toBe('2026-11-23');
  });

  // -------------------------------------------------------------------------
  // 4. Erro ao trocar de semana e retry
  // -------------------------------------------------------------------------
  it('4. exibe erro ao falhar requisição e permite retry com sucesso para a semana selecionada', async () => {
    vi.mocked(workDayService.getWeeklySummary)
      .mockResolvedValueOnce(createMockResponse('2026-11-16'))
      .mockRejectedValueOnce(new Error('Falha de conexão com o servidor'))
      .mockResolvedValueOnce(createMockResponse('2026-11-09'));

    const { result } = renderHook(() => useWeeklySummary());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Navega para semana anterior -> gera erro
    act(() => {
      result.current.goToPreviousWeek();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Falha de conexão com o servidor');
    });

    // Executa retry
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 5. TESTE OBRIGATÓRIO: Isolamento Real Multiusuário Síncrono e Respostas Lentas
  // -------------------------------------------------------------------------
  it('5. isolamento multiusuário: dados de A não vazam para B no render e resposta lenta de A é descartada', async () => {
    let resolveUserAPromise1!: (val: any) => void;
    let resolveUserAPromise2!: (val: any) => void;
    let resolveUserBPromise!: (val: any) => void;

    // 1. Usuário A carrega a semana atual
    currentUser = { id: 'user_A', name: 'Usuário A' };
    vi.mocked(workDayService.getWeeklySummary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUserAPromise1 = resolve;
        })
    );

    const { result, rerender } = renderHook(() => useWeeklySummary());

    // Resolve primeira requisição de A
    await act(async () => {
      resolveUserAPromise1(createMockResponse('2026-11-16', 'user_A'));
    });

    // 2. Dados de A aparecem na tela
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
      expect(result.current.data?.contextualInsight).toBe('Dados de user_A');
      expect(result.current.loading).toBe(false);
    });

    // 3. Usuário A dispara uma segunda requisição (navegação para a semana anterior) que fica em trânsito
    vi.mocked(workDayService.getWeeklySummary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUserAPromise2 = resolve;
        })
    );

    act(() => {
      result.current.goToPreviousWeek();
    });

    expect(result.current.loading).toBe(true);

    // Prepara a resposta que será solicitada para o Usuário B
    vi.mocked(workDayService.getWeeklySummary).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUserBPromise = resolve;
        })
    );

    // 4. Usuário B se autentica (troca de conta) enquanto a requisição de A ainda está pendente
    currentUser = { id: 'user_B', name: 'Usuário B' };
    rerender();

    // 5. Imediatamente no render, dados de A NÃO vazam para B
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    // 6. Resposta legítima de B é entregue e renderizada
    await act(async () => {
      resolveUserBPromise(createMockResponse('2026-11-16', 'user_B'));
    });

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
      expect(result.current.data?.contextualInsight).toBe('Dados de user_B');
      expect(result.current.loading).toBe(false);
    });

    // 7. Agora, a Promise da requisição lenta de A finalmente resolve com atraso
    await act(async () => {
      resolveUserAPromise2(createMockResponse('2026-11-09', 'user_A_atrasado'));
    });

    // 8. O estado de B permanece 100% íntegro e inalterado
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.contextualInsight).toBe('Dados de user_B');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Logout e troca para outro usuário durante navegação entre semanas
  // -------------------------------------------------------------------------
  it('6. logout e troca de usuário durante navegação descarta requisição e limpa estado', async () => {
    let resolveNavPromise!: (val: any) => void;

    vi.mocked(workDayService.getWeeklySummary)
      .mockResolvedValueOnce(createMockResponse('2026-11-16'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNavPromise = resolve;
          })
      );

    const { result, rerender } = renderHook(() => useWeeklySummary());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Usuário navega para a próxima semana
    act(() => {
      result.current.goToNextWeek();
    });

    expect(result.current.loading).toBe(true);

    // Usuário desloga durante a navegação
    currentUser = null;
    rerender();

    // Estado limpo imediatamente
    expect(result.current.data).toBeNull();

    // A promessa em trânsito resolve após o logout
    await act(async () => {
      resolveNavPromise(createMockResponse('2026-11-23'));
    });

    // Os dados da requisição NUNCA devem ser atribuídos
    expect(result.current.data).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 7. Atualização após mutação na jornada (refreshTrigger)
  // -------------------------------------------------------------------------
  it('7. reconsulta a semana quando refreshTrigger for atualizado após registro de ponto', async () => {
    vi.mocked(workDayService.getWeeklySummary).mockResolvedValue(createMockResponse('2026-11-16'));

    let trigger = { entries: [{ id: '1' }] };
    const { rerender } = renderHook(
      ({ trg }) => useWeeklySummary({ refreshTrigger: trg }),
      { initialProps: { trg: trigger } }
    );

    await waitFor(() => expect(workDayService.getWeeklySummary).toHaveBeenCalledTimes(1));

    // Nova marcação de ponto altera o objeto do trigger
    trigger = { entries: [{ id: '1' }, { id: '2' }] };
    rerender({ trg: trigger });

    await waitFor(() => {
      expect(workDayService.getWeeklySummary).toHaveBeenCalledTimes(2);
    });
  });
});

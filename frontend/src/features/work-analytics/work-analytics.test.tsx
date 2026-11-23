// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsPage } from '../../pages/AnalyticsPage';
import { useWorkAnalytics } from './useWorkAnalytics';
import { useAuth } from '../../contexts/AuthContext';
import { workDayService } from '../../services/work-day.service';
import { bankHoursService } from '../../services/bank-hours.service';
import { api } from '../../services/api';
import { MonthlyHistoryResponse, MonthlyDaySummary } from '../../types/work-day';
import { BankHoursResponse } from '../../types/bank-hours';
import { PlannedVsWorkedChart } from './components/PlannedVsWorkedChart';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/work-day.service', () => ({
  workDayService: {
    getMonthlyWorkDays: vi.fn(),
    getTodayWorkDay: vi.fn(),
    getWeeklySummary: vi.fn(),
  },
}));

vi.mock('../../services/bank-hours.service', () => ({
  bankHoursService: {
    getBankHours: vi.fn(),
    saveBankHoursConfig: vi.fn(),
  },
}));

describe('WorkAnalytics — Suíte de Homologação da ETAPA 12.5.3', () => {
  const USER_A = { id: 'user_alpha', name: 'Colaborador Alpha' };
  const USER_B = { id: 'user_beta', name: 'Colaborador Beta' };
  const TODAY_STR = '2026-11-18';

  const generateMockMonthResponse = (monthStr: string): MonthlyHistoryResponse => {
    const [yearStr, monthStrPart] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStrPart, 10);
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInMonth = month === 2 ? (isLeap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

    const days: MonthlyDaySummary[] = Array.from({ length: daysInMonth }).map((_, i) => {
      const dayNum = i + 1;
      const date = `${monthStr}-${String(dayNum).padStart(2, '0')}`;
      const isPast = date < TODAY_STR;
      const isToday = date === TODAY_STR;
      const isWeekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());

      if (isWeekend) {
        return {
          date,
          expectedMinutes: 0,
          workedMinutes: 0,
          currentSessionMinutes: 0,
          totalWorkedMinutes: 0,
          balanceMinutes: 0,
          isOpen: false,
          status: 'REST_DAY',
          entries: [],
        };
      }

      if (isToday) {
        return {
          date,
          expectedMinutes: 480,
          workedMinutes: 240,
          currentSessionMinutes: 60,
          totalWorkedMinutes: 240, // Already includes active session!
          balanceMinutes: -240,
          isOpen: true,
          status: 'IN_PROGRESS',
          entries: [
            { id: `in-${date}`, type: 'CLOCK_IN', timestamp: `${date}T08:00:00Z` },
          ],
        };
      }

      if (isPast) {
        // Deterministic worked time: 480 min (8h)
        return {
          date,
          expectedMinutes: 480,
          workedMinutes: 480,
          currentSessionMinutes: 0,
          totalWorkedMinutes: 480,
          balanceMinutes: 0,
          isOpen: false,
          status: 'RECORDED',
          entries: [
            { id: `in-${date}`, type: 'CLOCK_IN', timestamp: `${date}T08:00:00Z` },
            { id: `out-${date}`, type: 'CLOCK_OUT', timestamp: `${date}T17:00:00Z` },
          ],
        };
      }

      // Future
      return {
        date,
        expectedMinutes: 480,
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: null,
        isOpen: false,
        status: 'FUTURE',
        entries: [],
      };
    });

    const recordedDays = days.filter((d) => d.status === 'RECORDED' || d.status === 'IN_PROGRESS');
    const totalWorked = recordedDays.reduce((acc, d) => acc + d.totalWorkedMinutes, 0);

    return {
      month: monthStr,
      summary: {
        totalWorkedMinutes: totalWorked,
        recordedDays: recordedDays.length,
        incompleteDays: 0,
        daysWithoutRecords: 0,
        excusedDays: 0,
      },
      days,
    };
  };

  const mockConfiguredBankHours = (configured = true): BankHoursResponse => {
    if (!configured) {
      return {
        configured: false,
        suggestedStartDate: null,
        config: null,
        period: null,
        summary: null,
        monthly: [],
        pending: [],
      };
    }

    return {
      configured: true,
      suggestedStartDate: null,
      config: {
        startDate: '2026-09-01',
        initialBalanceMinutes: 120, // 2h saldo inicial
      },
      period: {
        startDate: '2026-09-01',
        endDate: TODAY_STR,
      },
      summary: {
        initialBalanceMinutes: 120,
        consolidatedBalanceMinutes: 240,
        todayBalanceMinutes: 0,
        liveBalanceMinutes: 240,
        creditMinutes: 180,
        debitMinutes: 60,
        accountedDays: 45,
        pendingDays: 0,
      },
      monthly: [
        {
          month: '2026-09',
          creditMinutes: 60,
          debitMinutes: 0,
          netMinutes: 60, // saldo fechamento: 120 + 60 = 180 (+03h00)
          accountedDays: 20,
          pendingDays: 0,
        },
        {
          month: '2026-10',
          creditMinutes: 30,
          debitMinutes: 60,
          netMinutes: -30, // saldo fechamento: 180 - 30 = 150 (+02h30)
          accountedDays: 22,
          pendingDays: 0,
        },
        {
          month: '2026-11',
          creditMinutes: 90,
          debitMinutes: 0,
          netMinutes: 90, // saldo fechamento: 150 + 90 = 240 (+04h00)
          accountedDays: 13,
          pendingDays: 0,
        },
      ],
      pending: [],
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();

    // Freeze system time to 2026-11-18 (quarta-feira)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));

    (useAuth as any).mockReturnValue({
      user: USER_A,
      logout: vi.fn(),
    });

    (workDayService.getMonthlyWorkDays as any).mockImplementation((month: string) =>
      Promise.resolve(generateMockMonthResponse(month))
    );

    (bankHoursService.getBankHours as any).mockImplementation(() =>
      Promise.resolve(mockConfiguredBankHours(true))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // =========================================================================
  // 1. CARREGAMENTO INICIAL E ASSERTIVAS NUMÉRICAS REAIS (SEÇÃO 8)
  // =========================================================================
  describe('1. Renderização e Assertivas Numéricas Reais', () => {
    it('1. Renderiza cabeçalho, filtro de período, cards resumidos e os 4 blocos de gráficos', async () => {
      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Análises e Tendências de Jornada')).toBeDefined();

      await waitFor(() => {
        expect(screen.getAllByText('Horas Trabalhadas').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Horas Previstas').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Diferença Líquida').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Média por Dia').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Variação Banco').length).toBeGreaterThan(0);
      });

      expect(screen.getByText('Evolução Histórica do Banco de Horas')).toBeDefined();
      expect(screen.getByText('Horas Previstas versus Horas Trabalhadas')).toBeDefined();
      expect(screen.getByText('Distribuição dos Saldos Diários')).toBeDefined();
      expect(screen.getByText('Comparativo Mensal Consolidado')).toBeDefined();
    });

    it('2. Valida assertivas numéricas exatas: horas trabalhadas, previstas, diferença e não duplicação da sessão atual', async () => {
      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Horas Trabalhadas').length).toBeGreaterThan(0);
      });

      // Em Novembro/2026:
      // Dias passados úteis (01 a 17): 12 dias úteis de 480 min = 5760 min
      // Hoje (18/11): 240 min (já inclui a sessão aberta de 60 min, sem duplicar!)
      // Total Trabalhado: 5760 + 240 = 6000 min = 100h 00min
      expect(screen.getAllByText('100h 00min').length).toBeGreaterThan(0);

      // Total Previsto: 13 dias úteis até hoje * 480 min = 6240 min = 104h 00min
      expect(screen.getAllByText('104h 00min').length).toBeGreaterThan(0);

      // Diferença Líquida: 6000 - 6240 = -240 min = -4h 00min
      expect(screen.getAllByText('-4h 00min').length).toBeGreaterThan(0);

      // Média por Dia em 13 dias registrados: 6000 / 13 = 462 min = 7h 42min
      expect(screen.getAllByText('7h 42min').length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. FILTROS DE PERÍODO E VALIDAÇÃO DE 12 COMPETÊNCIAS
  // =========================================================================
  describe('2. Filtros de Período e Validação Customizada', () => {
    it('3. Alternância entre presets consulta competências corretas', async () => {
      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Últimos 3 meses')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Últimos 3 meses/i }));

      await waitFor(() => {
        expect(workDayService.getMonthlyWorkDays).toHaveBeenCalledWith('2026-09');
        expect(workDayService.getMonthlyWorkDays).toHaveBeenCalledWith('2026-10');
        expect(workDayService.getMonthlyWorkDays).toHaveBeenCalledWith('2026-11');
      });
    });

    it('4. Filtro personalizado: valida 12 competências e impede 13 meses', async () => {
      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Personalizado')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Personalizado/i }));

      const startInput = screen.getByLabelText('Data inicial');
      const endInput = screen.getByLabelText('Data final');
      const applyBtn = screen.getByRole('button', { name: /Aplicar intervalo/i });

      // 01/01/2026 a 01/01/2027 abrange 13 competências
      fireEvent.change(startInput, { target: { value: '2026-01-01' } });
      fireEvent.change(endInput, { target: { value: '2027-01-01' } });
      fireEvent.click(applyBtn);

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/não pode abranger mais de 12 competências mensais/i)).toBeDefined();
    });
  });

  // =========================================================================
  // 3. BANCO DE HORAS E INTERVALOS PARCIAIS (SEÇÃO 3)
  // =========================================================================
  describe('3. Banco de Horas e Intervalos Parciais', () => {
    it('5. Intervalo personalizado de fração de mês (10 a 15 de novembro): exibe "—" e "Apenas competência integral"', async () => {
      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Personalizado')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Personalizado/i }));

      const startInput = screen.getByLabelText('Data inicial');
      const endInput = screen.getByLabelText('Data final');
      const applyBtn = screen.getByRole('button', { name: /Aplicar intervalo/i });

      fireEvent.change(startInput, { target: { value: '2026-11-10' } });
      fireEvent.change(endInput, { target: { value: '2026-11-15' } });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(screen.getByText('Apenas competência integral')).toBeDefined();
      });

      // Não exibe variação de +01h30m (que pertenceria a novembro inteiro)
      expect(screen.queryByText('+01h 30m')).toBeNull();
    });

    it('6. Competências integrais nos Últimos 3 meses exibem fechamento oficial real (+03h00, +02h30, +04h00)', async () => {
      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Horas Trabalhadas').length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getByRole('button', { name: /Últimos 3 meses/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Gráfico de evolução do saldo oficial/i)).toBeDefined();
      });

      // Validação numérica na tabela acessível de fechamento mensal
      expect(screen.getAllByText('+3h 00min').length).toBeGreaterThan(0); // Set/2026: 120 + 60 = 180 min
      expect(screen.getAllByText('+2h 30min').length).toBeGreaterThan(0); // Out/2026: 180 - 30 = 150 min
      expect(screen.getAllByText('+4h 00min').length).toBeGreaterThan(0); // Nov/2026: 150 + 90 = 240 min
    });
  });

  // =========================================================================
  // 4. DISTINÇÃO ENTRE BANCO NÃO CONFIGURADO E FALHA NA API (SEÇÃO 4)
  // =========================================================================
  describe('4. Distinção entre Banco Não Configurado e Falha na API', () => {
    it('7. Falha na consulta de Banco de Horas exibe "Indisponível" (nunca "Não configurado")', async () => {
      (bankHoursService.getBankHours as any).mockRejectedValueOnce(
        new Error('Network error on bank hours')
      );

      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Banco de Horas Indisponível')).toBeDefined();
        expect(screen.getByText('Erro na consulta do banco')).toBeDefined();
      });

      // Não deve dizer que está não configurado
      expect(screen.queryByText('Banco de Horas não está configurado nesta conta')).toBeNull();
    });

    it('8. Quando a API responde explicitamente configured: false, exibe "Não configurado"', async () => {
      (bankHoursService.getBankHours as any).mockResolvedValueOnce(
        mockConfiguredBankHours(false)
      );

      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Banco de Horas não está configurado nesta conta/i)).toBeDefined();
        expect(screen.getByText('Definir início e saldo')).toBeDefined();
      });
    });
  });

  // =========================================================================
  // 5. RESILIÊNCIA, RETRY COM DADOS ANTERIORES E MESES AUSENTES (SEÇÕES 2 & 7)
  // =========================================================================
  describe('5. Resiliência, Retry com Dados Anteriores e Meses Ausentes', () => {
    it('9. Mês que falhou (Outubro) exibe status "Indisponível" sem zeros fictícios', async () => {
      (workDayService.getMonthlyWorkDays as any).mockImplementation((m: string) => {
        if (m === '2026-10') {
          return Promise.reject(new Error('500 on 2026-10'));
        }
        return Promise.resolve(generateMockMonthResponse(m));
      });

      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Horas Trabalhadas').length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getByRole('button', { name: /Últimos 3 meses/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeDefined();
        expect(screen.getByText(/Não foi possível carregar os dados de: 2026-10/i)).toBeDefined();
      });

      // No card de Outubro no comparativo mensal, deve exibir 'Indisponível' e não 0h
      expect(screen.getAllByText('Indisponível').length).toBeGreaterThan(0);
    });

    it('10. Sucesso -> Refresh falho -> Preserva dados anteriores com banner de alerta e botão de retry', async () => {
      const { result } = renderHook(() => useWorkAnalytics(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });

      const initialWorkedMinutes = result.current.data?.summaryMetrics.totalWorkedMinutes;
      expect(initialWorkedMinutes).toBeGreaterThan(0);

      // Agora a próxima chamada rejeita
      (workDayService.getMonthlyWorkDays as any).mockRejectedValueOnce(
        new Error('503 Service Unavailable')
      );

      await act(async () => {
        await result.current.refresh();
      });

      // Dados anteriores continuam preservados (não vira null)
      expect(result.current.data).not.toBeNull();
      expect(result.current.data?.summaryMetrics.totalWorkedMinutes).toBe(initialWorkedMinutes);

      // Exibe mensagem de erro de atualização
      expect(result.current.refreshError).toContain('Não foi possível atualizar os dados do período');
      expect(result.current.isStale).toBe(true);

      // Ao dar retry com o backend restaurado, limpa refreshError
      (workDayService.getMonthlyWorkDays as any).mockImplementation((m: string) =>
        Promise.resolve(generateMockMonthResponse(m))
      );

      await act(async () => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.refreshError).toBeNull();
        expect(result.current.isStale).toBe(false);
      });
    });
  });

  // =========================================================================
  // 6. ISOLAMENTO DE USUÁRIOS E ZERO MUTAÇÕES
  // =========================================================================
  describe('6. Isolamento Estrito de Contas e Zero Mutações', () => {
    it('11. Troca de usuário limpa imediatamente os dados do usuário anterior', async () => {
      const { result, rerender } = renderHook(() => useWorkAnalytics(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });

      (useAuth as any).mockReturnValue({
        user: USER_B,
        logout: vi.fn(),
      });

      rerender();
      expect(result.current.data).toBeNull();
    });

    it('12. Logout (user = null) limpa imediatamente o estado', async () => {
      const { result, rerender } = renderHook(() => useWorkAnalytics(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });

      (useAuth as any).mockReturnValue({
        user: null,
        logout: vi.fn(),
      });

      rerender();
      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('13. Garante rigorosamente ZERO mutações HTTP (POST, PUT, PATCH, DELETE) durante todo o fluxo', async () => {
      const postSpy = vi.spyOn(api, 'post');
      const putSpy = vi.spyOn(api, 'put');
      const patchSpy = vi.spyOn(api, 'patch');
      const deleteSpy = vi.spyOn(api, 'delete');

      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Horas Trabalhadas').length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getByRole('button', { name: /Últimos 3 meses/i }));
      await waitFor(() => {
        expect(screen.getAllByText('Horas Trabalhadas').length).toBeGreaterThan(0);
      });

      expect(postSpy).not.toHaveBeenCalled();
      expect(putSpy).not.toHaveBeenCalled();
      expect(patchSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();

      postSpy.mockRestore();
      putSpy.mockRestore();
      patchSpy.mockRestore();
      deleteSpy.mockRestore();
    });

    it('14. Extrato com lacuna intermediária exibe "Extrato incompleto" no card e "Não confirmado" no gráfico', async () => {
      // Configura extrato com Outubro ausente
      const gapBankHours = mockConfiguredBankHours(true);
      gapBankHours.monthly = [
        {
          month: '2026-09',
          creditMinutes: 60,
          debitMinutes: 0,
          netMinutes: 60,
          accountedDays: 20,
          pendingDays: 0,
        },
        {
          month: '2026-11',
          creditMinutes: 90,
          debitMinutes: 0,
          netMinutes: 90,
          accountedDays: 13,
          pendingDays: 0,
        },
      ];
      (bankHoursService.getBankHours as any).mockResolvedValue(gapBankHours);

      render(
        <MemoryRouter>
          <AnalyticsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Horas Trabalhadas').length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getByRole('button', { name: /Últimos 3 meses/i }));

      await waitFor(() => {
        // Card superior: deve indicar Extrato incompleto (não erro de conexão nem não configurado)
        expect(screen.getByText('Extrato incompleto')).toBeDefined();
        // Na tabela do gráfico de evolução: status do mês posterior à lacuna é "Não confirmado"
        expect(screen.getByText('Não confirmado')).toBeDefined();
        expect(screen.getByText('— (Lacuna no extrato)')).toBeDefined();
      });
    });

    it('15. Hook useWorkAnalytics descarta datas inválidas como 2026-11-31 e deduplica datas repetidas', async () => {
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce({
        month: '2026-11',
        days: [
          {
            date: '2026-11-01',
            expectedMinutes: 480,
            workedMinutes: 480,
            currentSessionMinutes: 0,
            totalWorkedMinutes: 480,
            balanceMinutes: 0,
            isOpen: false,
            status: 'RECORDED',
            entries: [],
          },
          // Data repetida (duplicata de 2026-11-01)
          {
            date: '2026-11-01',
            expectedMinutes: 480,
            workedMinutes: 480,
            currentSessionMinutes: 0,
            totalWorkedMinutes: 480,
            balanceMinutes: 0,
            isOpen: false,
            status: 'RECORDED',
            entries: [],
          },
          // Data civil inexistente
          {
            date: '2026-11-31',
            expectedMinutes: 480,
            workedMinutes: 480,
            currentSessionMinutes: 0,
            totalWorkedMinutes: 480,
            balanceMinutes: 0,
            isOpen: false,
            status: 'RECORDED',
            entries: [],
          },
        ],
      });

      const { result } = renderHook(() => useWorkAnalytics(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });

      // Apenas 1 dia válido único (2026-11-01) deve ser computado
      expect(result.current.data?.summaryMetrics.recordedDaysCount).toBe(1);
      expect(result.current.data?.summaryMetrics.totalWorkedMinutes).toBe(480);
      // Mês é classificado como parcial porque faltam os demais dias de Novembro
      expect(result.current.data?.partialMonths).toContain('2026-11');
    });

    it('16. Competência com 0h trabalhadas renderiza barra com altura 0% sem altura mínima enganosa', () => {
      const aggregations = [
        {
          month: '2026-11',
          monthLabel: 'Nov/2026',
          status: 'empty' as const,
          isCurrentMonth: false,
          isFractionOfCompetence: false,
          totalWorkedMinutes: 0,
          totalExpectedMinutes: 480,
          differenceMinutes: -480,
          recordedDaysCount: 0,
          bankHoursNetMinutes: null,
          bankHoursCumulativeClosingBalance: null,
          isBankHoursActiveInMonth: false,
          hasIncompleteData: false,
        },
      ];

      const { container } = render(<PlannedVsWorkedChart aggregations={aggregations} />);

      // A barra trabalhada deve ter height: 0% e classe h-0
      const workedBar = container.querySelector('[title="Trabalhado: 0h 00min"]');
      expect(workedBar).not.toBeNull();
      expect(workedBar?.getAttribute('style')).toContain('height: 0%');
      expect(workedBar?.className).toContain('h-0');
    });
  });
});

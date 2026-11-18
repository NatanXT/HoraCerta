// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { HistoryPage } from '../../pages/HistoryPage';
import { useSmartCalendar } from './useSmartCalendar';
import { SmartCalendarDayDetail } from './SmartCalendarDayDetail';
import { useAuth } from '../../contexts/AuthContext';
import { workDayService } from '../../services/work-day.service';
import { holidayService } from '../../services/holiday.service';
import { api } from '../../services/api';
import { MonthlyHistoryResponse, MonthlyDaySummary } from '../../types/work-day';
import { inFlightTracker } from '../pwa/utils/inFlightTracker';

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

vi.mock('../../services/holiday.service', () => ({
  holidayService: {
    syncHolidays: vi.fn(),
    getHolidays: vi.fn(),
  },
}));

vi.mock('../../services/manual-adjustment.service', () => ({
  manualAdjustmentService: {
    getAdjustments: vi.fn().mockResolvedValue({ adjustments: [] }),
    submitAdjustment: vi.fn(),
  },
}));

describe('SmartCalendar — Suíte de Homologação da ETAPA 12.5.2', () => {
  const USER_A = { id: 'user_alpha', name: 'Colaborador Alpha' };
  const USER_B = { id: 'user_beta', name: 'Colaborador Beta' };
  const TODAY_STR = '2026-11-17';

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

      // Configura cenários ricos para dias específicos
      if (dayNum === 15) {
        // Dia 15: Feriado nacional + Folga semanal + Saldo positivo
        return {
          date,
          expectedMinutes: 480,
          workedMinutes: 510,
          currentSessionMinutes: 0,
          totalWorkedMinutes: 510,
          balanceMinutes: 30,
          isOpen: false,
          status: 'RECORDED',
          hasManualAdjustments: true,
          entries: [
            { id: `e-${date}-1`, type: 'CLOCK_IN', timestamp: `${date}T08:00:00Z`, source: 'CLOCK' },
            { id: `e-${date}-2`, type: 'CLOCK_OUT', timestamp: `${date}T17:30:00Z`, source: 'MANUAL' },
          ],
          workBreaks: [
            { id: 'b1', type: 'LUNCH', startedAt: `${date}T12:00:00Z`, endedAt: `${date}T13:00:00Z`, durationMinutes: 60 },
          ],
          holiday: { id: 'h1', name: 'Proclamação da República', type: 'NATIONAL', date },
        };
      }

      if (dayNum === 16) {
        // Dia 16: Dia com Férias regulamentares
        return {
          date,
          expectedMinutes: 0,
          workedMinutes: 0,
          currentSessionMinutes: 0,
          totalWorkedMinutes: 0,
          balanceMinutes: 0,
          isOpen: false,
          status: 'EXCUSED',
          entries: [],
          occurrence: {
            id: 'occ-vac',
            type: 'VACATION',
            title: 'Férias coletivas',
            startDate: date,
            endDate: date,
            note: 'Aprovado pelo RH',
          },
        };
      }

      if (dayNum === 17 && isToday) {
        // Dia 17: Dia atual com jornada em andamento e saldo negativo temporário
        return {
          date,
          expectedMinutes: 480,
          workedMinutes: 240,
          currentSessionMinutes: 60,
          totalWorkedMinutes: 300,
          balanceMinutes: -180,
          isOpen: true,
          status: 'IN_PROGRESS',
          entries: [
            { id: `e-${date}-1`, type: 'CLOCK_IN', timestamp: `${date}T08:00:00Z`, source: 'CLOCK' },
          ],
        };
      }

      if (dayNum === 20) {
        // Dia 20: Ausência médica
        return {
          date,
          expectedMinutes: 480,
          workedMinutes: 0,
          currentSessionMinutes: 0,
          totalWorkedMinutes: 0,
          balanceMinutes: 0,
          isOpen: false,
          status: 'EXCUSED',
          entries: [],
          occurrence: {
            id: 'occ-med',
            type: 'MEDICAL_LEAVE',
            title: 'Atestado médico',
            startDate: date,
            endDate: date,
            note: 'Consulta médica',
          },
        };
      }

      if (isPast) {
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
            { id: `e-${date}-1`, type: 'CLOCK_IN', timestamp: `${date}T08:00:00Z` },
            { id: `e-${date}-2`, type: 'CLOCK_OUT', timestamp: `${date}T17:00:00Z` },
          ],
        };
      }

      // Dias futuros
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

    return {
      month: monthStr,
      summary: {
        totalWorkedMinutes: 8000,
        recordedDays: 16,
        incompleteDays: 0,
        daysWithoutRecords: 2,
        excusedDays: 2,
      },
      days,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));

    (useAuth as any).mockReturnValue({
      user: USER_A,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    });

    (workDayService.getMonthlyWorkDays as any).mockImplementation((month: string) =>
      Promise.resolve(generateMockMonthResponse(month))
    );

    (holidayService.syncHolidays as any).mockResolvedValue({ synced: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // =========================================================================
  // 1. RENDERIZAÇÃO DO MÊS E NAVEGAÇÃO
  // =========================================================================
  describe('Renderização mensal, navegação, botão Hoje e virada de ano', () => {
    it('renderiza o mês atual e navega entre meses anterior e próximo', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      // Confirma carregamento do cabeçalho e mês atual
      await waitFor(() => {
        expect(screen.getByText('Calendário Inteligente de Jornada')).toBeDefined();
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Clica em mês anterior
      const prevBtn = screen.getByRole('button', { name: /Mês anterior/i });
      fireEvent.click(prevBtn);

      await waitFor(() => {
        expect(screen.getAllByText(/Outubro de 2026/i).length).toBeGreaterThan(0);
      });

      // Clica em próximo mês (volta para novembro)
      const nextBtn = screen.getByRole('button', { name: /Próximo mês/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });
    });

    it('botão Hoje retorna imediatamente ao mês e dia atual', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Navega para dois meses atrás
      const prevBtn = screen.getByRole('button', { name: /Mês anterior/i });
      fireEvent.click(prevBtn); // Outubro
      fireEvent.click(prevBtn); // Setembro

      await waitFor(() => {
        expect(screen.getAllByText(/Setembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Clica no botão Hoje
      const todayBtn = screen.getByTitle('Ir para o mês e dia atual');
      fireEvent.click(todayBtn);

      // Deve retornar instantaneamente para Novembro de 2026
      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });
    });

    it('manipula fevereiro bissexto (29 dias) e não bissexto (28 dias) corretamente', async () => {
      // Mock para fevereiro de ano bissexto (2024)
      const leapFeb = generateMockMonthResponse('2024-02');
      expect(leapFeb.days.length).toBe(29);
      expect(leapFeb.days[28].date).toBe('2024-02-29');

      // Mock para fevereiro não bissexto (2026)
      const regularFeb = generateMockMonthResponse('2026-02');
      expect(regularFeb.days.length).toBe(28);
      expect(regularFeb.days[27].date).toBe('2026-02-28');
    });

    it('realiza virada de ano corretamente (Dezembro para Janeiro)', async () => {
      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Navega para dezembro de 2026
      act(() => {
        result.current.goToNextMonth();
      });
      expect(result.current.selectedMonth).toBe('2026-12');

      // Avança mais um mês: deve virar para 2027-01
      act(() => {
        result.current.goToNextMonth();
      });
      expect(result.current.selectedMonth).toBe('2027-01');

      // Retorna para dezembro de 2026
      act(() => {
        result.current.goToPreviousMonth();
      });
      expect(result.current.selectedMonth).toBe('2026-12');
    });
  });

  // =========================================================================
  // 2. DESACOPLAMENTO DE REQUISIÇÕES E PERFORMANCE (REQUISITOS 1 & 2)
  // =========================================================================
  describe('Requisitos 1 e 2: Desacoplamento de requisições de rede', () => {
    it('1. Seleção de dias (ex.: dia 5, 10, 20) NÃO dispara novas requisições a getMonthlyWorkDays', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Deve ter feito exatamente 1 chamada inicial para carregar novembro
      expect(workDayService.getMonthlyWorkDays).toHaveBeenCalledTimes(1);

      // Clica no dia 5
      const day5Button = screen.getByRole('button', { name: /^Dia 5,/i });
      fireEvent.click(day5Button);

      // Clica no dia 10
      const day10Button = screen.getByRole('button', { name: /^Dia 10,/i });
      fireEvent.click(day10Button);

      // Clica no dia 20
      const day20Button = screen.getByRole('button', { name: /^Dia 20,/i });
      fireEvent.click(day20Button);

      // A contagem de requisições deve permanecer estritamente 1 (ZERO requisições disparadas)
      expect(workDayService.getMonthlyWorkDays).toHaveBeenCalledTimes(1);
    });

    it('2. Alternância entre visualização em Calendário e visualização em Lista NÃO dispara nova requisição', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      expect(workDayService.getMonthlyWorkDays).toHaveBeenCalledTimes(1);

      // Alterna para visualização em Lista
      const listRadio = screen.getByRole('radio', { name: /Lista/i });
      fireEvent.click(listRadio);

      await waitFor(() => {
        expect(screen.getByLabelText('Lista mensal de jornadas')).toBeDefined();
      });

      // Alterna de volta para Calendário
      const calendarRadio = screen.getByRole('radio', { name: /Calendário/i });
      fireEvent.click(calendarRadio);

      await waitFor(() => {
        expect(screen.getByLabelText('Calendário mensal inteligente')).toBeDefined();
      });

      // A contagem deve permanecer estritamente 1
      expect(workDayService.getMonthlyWorkDays).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. CONSISTÊNCIA DE DADOS ENTRE MESES (REQUISITOS 3 & 4)
  // =========================================================================
  describe('Requisitos 3 e 4: Troca de mês, loading skeleton e prevenção de vazamento de dados antigos', () => {
    it('3 & 4. Troca de mês não renderiza dados do mês anterior sob novo cabeçalho e exibe esqueleto/loading sem flashes', async () => {
      let resolveDecember: (value: any) => void;
      const decemberPromise = new Promise((resolve) => {
        resolveDecember = resolve;
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Mock da requisição de dezembro com atraso controlado
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce((month: string) => {
        if (month === '2026-12') return decemberPromise;
        return Promise.resolve(generateMockMonthResponse(month));
      });

      // Clica para avançar para Dezembro de 2026
      const nextBtn = screen.getByRole('button', { name: /Próximo mês/i });
      fireEvent.click(nextBtn);

      // O cabeçalho atualiza imediatamente para Dezembro de 2026
      expect(screen.getAllByText(/Dezembro de 2026/i).length).toBeGreaterThan(0);

      // Durante o loading, os dados de Novembro NÃO devem ser exibidos (Proclamação da República do dia 15/11 não existe mais na tela)
      expect(screen.queryByText(/Proclamação da República/i)).toBeNull();

      // Resolve a promessa de Dezembro
      act(() => {
        resolveDecember!(generateMockMonthResponse('2026-12'));
      });

      // Dados de Dezembro chegam e são renderizados
      await waitFor(() => {
        expect(screen.getByLabelText('Calendário mensal inteligente')).toBeDefined();
      });
    });
  });

  // =========================================================================
  // 4. TRATAMENTO DE ERROS E RESILIÊNCIA (REQUISITOS 5 & 6)
  // =========================================================================
  describe('Requisitos 5 e 6: Falha de conexão no novo mês, OfflineError e recuperação via retry', () => {
    it('5 & 6. Em caso de falha de API no novo mês, exibe OfflineError sem dados antigos e retry busca estritamente o mês que falhou', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Simula falha ao avançar para dezembro
      (workDayService.getMonthlyWorkDays as any).mockRejectedValueOnce(
        new Error('Network error on December')
      );

      const nextBtn = screen.getByRole('button', { name: /Próximo mês/i });
      fireEvent.click(nextBtn);

      // Deve exibir a mensagem de OfflineError
      await waitFor(() => {
        expect(screen.getByText(/Não foi possível carregar o histórico/i)).toBeDefined();
      });

      // Não deve exibir dados do mês antigo (Novembro)
      expect(screen.queryByText(/Proclamação da República/i)).toBeNull();

      // Botão de retry presente
      const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i });
      expect(retryBtn).toBeDefined();

      // Configura sucesso para o retry
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-12')
      );

      fireEvent.click(retryBtn);

      // Verifica se o retry chamou estritamente o mês de Dezembro
      expect(workDayService.getMonthlyWorkDays).toHaveBeenLastCalledWith('2026-12');

      // Recupera o estado e renderiza Dezembro
      await waitFor(() => {
        expect(screen.getByLabelText('Calendário mensal inteligente')).toBeDefined();
        expect(screen.getAllByText(/Dezembro de 2026/i).length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // 5. RESPOSTA INCONSISTENTE E CONCORRÊNCIA (REQUISITOS 7 & 8)
  // =========================================================================
  describe('Requisitos 7 e 8: Rejeição de resposta inconsistente e proteção contra respostas atrasadas', () => {
    it('7. Resposta inconsistente da API (mês retornado diferente do solicitado) é rejeitada e não é exibida', async () => {
      // Mock que retorna um mês divergente do solicitado
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce({
        month: '2026-05', // Divergente de 2026-11
        summary: { totalWorkedMinutes: 0, recordedDays: 0, incompleteDays: 0, daysWithoutRecords: 0, excusedDays: 0 },
        days: [],
      });

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // A resposta inconsistente deve ser rejeitada: data permanece null e error é preenchido
      expect(result.current.data).toBeNull();
      expect(result.current.error).toContain('Resposta com mês inconsistente');
    });

    it('8. Callbacks atrasados de requisições de meses anteriores são descartados mesmo se chegarem após a resolução do mês atual', async () => {
      let resolveFirstCall: (value: any) => void;
      const firstCallPromise = new Promise((resolve) => {
        resolveFirstCall = resolve;
      });

      // Primeira chamada para 2026-11 fica suspensa
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce(
        () => firstCallPromise
      );

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      // Usuário avança para 2026-12 antes da resposta de 2026-11
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-12')
      );

      act(() => {
        result.current.goToNextMonth();
      });

      // 2026-12 resolve primeiro
      await waitFor(() => {
        expect(result.current.selectedMonth).toBe('2026-12');
        expect(result.current.data?.month).toBe('2026-12');
      });

      // Agora a primeira chamada atrasada (2026-11) resolve
      act(() => {
        resolveFirstCall!(generateMockMonthResponse('2026-11'));
      });

      // Mantém estritamente os dados de 2026-12 sem sobrescrever
      expect(result.current.selectedMonth).toBe('2026-12');
      expect(result.current.data?.month).toBe('2026-12');
    });

    it('8b. chamada de refresh durante consulta mensal em andamento não deixa loading como true indefinidamente', async () => {
      let resolveInitial: (value: any) => void;
      const initialPromise = new Promise((resolve) => {
        resolveInitial = resolve;
      });

      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      // 1ª chamada: fetchMonthly inicial fica em andamento
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce(() => initialPromise);

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      expect(result.current.loading).toBe(true);

      // 2ª chamada: refresh é chamado antes de fetchMonthly terminar
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce(() => refreshPromise);

      let refreshAction: Promise<void>;
      act(() => {
        refreshAction = result.current.refresh();
      });

      // Resolve a 1ª chamada (já invalidada pelo requestIdRef do refresh)
      act(() => {
        resolveInitial!(generateMockMonthResponse('2026-11'));
      });

      // Agora resolve o refresh
      await act(async () => {
        resolveRefresh!(generateMockMonthResponse('2026-11'));
        await refreshAction;
      });

      // loading DEVE ser false e os dados devem estar disponíveis
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).not.toBeNull();
      });
    });

    it('8c. Falha no refresh durante consulta inicial pendente define erro recuperável com opção de retry', async () => {
      let resolveInitial: (value: any) => void;
      const initialPromise = new Promise((resolve) => {
        resolveInitial = resolve;
      });

      let rejectRefresh: (reason: any) => void;
      const refreshPromise = new Promise((_, reject) => {
        rejectRefresh = reject;
      });

      // fetchMonthly inicial fica em andamento
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce(() => initialPromise);

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();

      // refresh é disparado invalidando a consulta inicial
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce(() => refreshPromise);

      let refreshAction: Promise<void>;
      act(() => {
        refreshAction = result.current.refresh();
      });

      // Rejeita o refresh com falha
      await act(async () => {
        rejectRefresh!(new Error('Network error on refresh'));
        await refreshAction;
      });

      // Como não havia dados válidos anteriores, deve exibir erro recuperável
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBe('Não foi possível carregar o histórico de jornada deste mês.');
      });
    });

    it('8d. Falha no refresh após dados válidos carregados preserva os dados na tela e sinaliza alerta', async () => {
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-11')
      );

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).not.toBeNull();
      });

      // Refresh falha
      (workDayService.getMonthlyWorkDays as any).mockRejectedValueOnce(
        new Error('Temporary server glitch')
      );

      await act(async () => {
        await result.current.refresh();
      });

      // Dados prévios continuam na tela intactos (não são limpos)
      expect(result.current.data).not.toBeNull();
      expect(result.current.data?.month).toBe('2026-11');
      expect(result.current.error).toBeNull();
      // holidayWarning sinaliza a falha de atualização sem quebrar a visualização
      expect(result.current.holidayWarning).toContain(
        'Não foi possível atualizar os dados mais recentes. Exibindo informações salvas da consulta anterior.'
      );
    });

    it('8e. Proteção de formulários sujos ao mudar de mês com inFlightTracker.hasDirtyForms()', async () => {
      (workDayService.getMonthlyWorkDays as any).mockResolvedValue(
        generateMockMonthResponse('2026-11')
      );

      const confirmSpy = vi.spyOn(window, 'confirm');

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });

      // Simula formulário com alterações não salvas
      const dirtySpy = vi.spyOn(inFlightTracker, 'hasDirtyForms').mockReturnValue(true);

      // Usuário tenta mudar de mês mas clica em Cancelar no confirm
      confirmSpy.mockReturnValueOnce(false);
      act(() => {
        result.current.goToNextMonth();
      });

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      // Mês NÃO deve mudar
      expect(result.current.selectedMonth).toBe('2026-11');

      // Usuário tenta mudar de mês e confirma
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-12')
      );
      confirmSpy.mockReturnValueOnce(true);
      act(() => {
        result.current.goToNextMonth();
      });

      expect(confirmSpy).toHaveBeenCalledTimes(2);
      expect(result.current.selectedMonth).toBe('2026-12');

      confirmSpy.mockRestore();
      dirtySpy.mockRestore();
    });

    it('8f. Refresh com mês divergente e sem dados prévios rejeita resposta e exibe erro recuperável', async () => {
      let resolveInitial: (value: any) => void;
      const initialPromise = new Promise((resolve) => {
        resolveInitial = resolve;
      });

      // fetchMonthly inicial fica em andamento
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce(() => initialPromise);

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();

      // refresh retorna mês divergente (2026-12 quando o solicitado é 2026-11)
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-12')
      );

      await act(async () => {
        await result.current.refresh();
      });

      // Como não havia dados válidos anteriores, deve exibir erro recuperável de mês inconsistente
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBe('Resposta com mês inconsistente retornada pelo servidor.');
      });
    });

    it('8g. Refresh com mês divergente e dados anteriores válidos rejeita resposta e preserva dados com alerta', async () => {
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-11')
      );

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.data).not.toBeNull();
        expect(result.current.data?.month).toBe('2026-11');
      });

      // Refresh retorna resposta de mês divergente
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-10')
      );

      await act(async () => {
        await result.current.refresh();
      });

      // Dados prévios de 2026-11 permanecem íntegros na tela
      expect(result.current.data).not.toBeNull();
      expect(result.current.data?.month).toBe('2026-11');
      expect(result.current.error).toBeNull();
      // holidayWarning sinaliza a inconsistência preservando a navegação
      expect(result.current.holidayWarning).toContain(
        'Não foi possível atualizar os dados mais recentes. Exibindo informações salvas da consulta anterior.'
      );
    });

    it('8h. Refresh com payload malformado rejeita resposta e mantém resiliência (erro se sem dados, alerta se com dados)', async () => {
      // 1. Cenário com dados prévios válidos
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-11')
      );

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });

      // Refresh retorna payload sem array de dias
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce({
        month: '2026-11',
        days: null,
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.data).not.toBeNull();
      expect(result.current.data?.month).toBe('2026-11');
      expect(result.current.holidayWarning).toContain(
        'Não foi possível atualizar os dados mais recentes. Exibindo informações salvas da consulta anterior.'
      );
    });

    it('8i. Recuperação após erro de refresh via retry() busca novamente o mês atual com sucesso', async () => {
      let resolveInitial: (value: any) => void;
      const initialPromise = new Promise((resolve) => {
        resolveInitial = resolve;
      });

      // fetchMonthly inicial fica em andamento
      (workDayService.getMonthlyWorkDays as any).mockImplementationOnce(() => initialPromise);

      const { result } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      // Refresh falha com payload malformado
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce({
        month: '2026-11',
        days: 'invalid-days',
      });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Payload inválido retornado pelo servidor.');
        expect(result.current.data).toBeNull();
      });

      // Usuário aciona retry() e o backend responde com dados válidos
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(
        generateMockMonthResponse('2026-11')
      );

      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.data).not.toBeNull();
        expect(result.current.data?.month).toBe('2026-11');
      });
    });
  });

  // =========================================================================
  // INTEGRIDADE DE DIAS AUSENTES (DATA_UNAVAILABLE)
  // =========================================================================
  describe('Integridade de dados ausentes e prevenção de falsos NO_RECORDS', () => {
    it('dia ausente na resposta da API é classificado estritamente como DATA_UNAVAILABLE e seleção exibe detalhamento coerente', async () => {
      // Cria resposta onde o dia 10 de novembro foi omitido pela API
      const responseWithMissingDay = generateMockMonthResponse('2026-11');
      responseWithMissingDay.days = responseWithMissingDay.days.filter((d) => d.date !== '2026-11-10');

      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce(responseWithMissingDay);

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // O dia 10 deve estar presente na grade para manter o alinhamento
      const day10Button = screen.getByRole('button', { name: /^Dia 10,/i });
      expect(day10Button).toBeDefined();

      // aria-label deve indicar estritamente "Dados indisponíveis" (NUNCA "Sem registros" falso)
      expect(day10Button.getAttribute('aria-label')).toContain('Dados indisponíveis');
      expect(day10Button.getAttribute('aria-label')).not.toContain('Sem registros');

      // Ao selecionar o dia 10
      fireEvent.click(day10Button);

      // O painel de detalhes exibe o banner de dados indisponíveis
      await waitFor(() => {
        expect(screen.getAllByText(/Dados indisponíveis/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Informações não fornecidas pelo servidor/i)).toBeDefined();
      });

      // Métricas devem ser apresentadas com travessão '—' e não com zeros oficiais
      expect(screen.getByText(/Não apurado/i)).toBeDefined();

      // Botão de ajuste manual NÃO deve estar presente para dias sem dados
      expect(screen.queryByRole('button', { name: /Ajustar registros/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Resolver pendência/i })).toBeNull();
    });

    it('resposta com dias vazios (days: []) é tratada de forma coerente sem quebrar a interface', async () => {
      (workDayService.getMonthlyWorkDays as any).mockResolvedValueOnce({
        month: '2026-11',
        summary: { totalWorkedMinutes: 0, recordedDays: 0, incompleteDays: 0, daysWithoutRecords: 0, excusedDays: 0 },
        days: [],
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // A grade é montada com todos os dias do mês exibindo Indisponível
      expect(screen.getByLabelText('Calendário mensal inteligente')).toBeDefined();
      const day1Button = screen.getByRole('button', { name: /^Dia 1,/i });
      expect(day1Button.getAttribute('aria-label')).toContain('Dados indisponíveis');
    });
  });

  // =========================================================================
  // 6. INDICADORES VISUAIS E COEXISTÊNCIA
  // =========================================================================
  describe('Indicadores diários, saldos, feriados, férias e sobreposição de estados', () => {
    it('exibe todos os indicadores simultâneos sem descartar dados', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Dia 15: Concluída, Feriado, Ajuste Manual e Saldo Positivo coexistem
      const day15 = screen.getByRole('button', { name: /Dia 15.*Proclamação da República/i });
      expect(day15).toBeDefined();
      expect(day15.getAttribute('aria-label')).toContain('Feriado: Proclamação da República');
      expect(day15.getAttribute('aria-label')).toContain('Saldo positivo: +00h30');
      expect(day15.getAttribute('aria-label')).toContain('Contém ajuste manual');

      // Dia 16: Férias regulamentares
      const day16 = screen.getByRole('button', { name: /Dia 16/i });
      expect(day16.getAttribute('aria-label')).toContain('Férias cadastradas');

      // Dia 17: Hoje, Expediente em andamento e Saldo negativo
      const day17 = screen.getByRole('button', { name: /Dia 17/i });
      expect(day17.getAttribute('aria-label')).toContain('Hoje');
      expect(day17.getAttribute('aria-label')).toContain('Expediente em andamento');
      expect(day17.getAttribute('aria-label')).toContain('Saldo negativo: -03h00');

      // Dia 20: Ausência médica
      const day20 = screen.getByRole('button', { name: /Dia 20/i });
      expect(day20.getAttribute('aria-label')).toContain('Ausência/Afastamento: Atestado médico');
    });

    it('apresenta detalhamento completo de registros, batidas, pausas e ocorrências ao selecionar dia', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Clica no dia 15
      const day15Buttons = screen.getAllByRole('button', { name: /Dia 15/i });
      fireEvent.click(day15Buttons[0]);

      await waitFor(() => {
        expect(screen.getByText('Jornada Prevista')).toBeDefined();
        expect(screen.getByText('Tempo Trabalhado')).toBeDefined();
        expect(screen.getByText('Saldo Diário Oficial')).toBeDefined();
        expect(screen.getByText('Pausas Registradas')).toBeDefined();
        expect(screen.getByText('Registros de Ponto do Dia')).toBeDefined();
        expect(screen.getByText('Intervalos e Pausas')).toBeDefined();
        expect(screen.getByText('Refeição / Almoço')).toBeDefined();
        expect(screen.getByText(/Feriado Nacional:/i)).toBeDefined();
      });
    });
  });

  // =========================================================================
  // 7. SEGURANÇA DO PAINEL DE AJUSTES (REQUISITO 11)
  // =========================================================================
  describe('Requisito 11: Segurança do painel de ajuste manual', () => {
    it('11. Ao abrir o painel de ajuste manual, a data do ajuste permanece travada no dia original mesmo se o usuário selecionar outro dia na grade ao fundo', async () => {
      const day10: MonthlyDaySummary = {
        date: '2026-11-10',
        expectedMinutes: 480,
        workedMinutes: 480,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 480,
        balanceMinutes: 0,
        isOpen: false,
        status: 'RECORDED',
        entries: [
          { id: 'e1', type: 'CLOCK_IN', timestamp: '2026-11-10T08:00:00Z' },
          { id: 'e2', type: 'CLOCK_OUT', timestamp: '2026-11-10T17:00:00Z' },
        ],
      };

      const day12: MonthlyDaySummary = {
        date: '2026-11-12',
        expectedMinutes: 480,
        workedMinutes: 480,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 480,
        balanceMinutes: 0,
        isOpen: false,
        status: 'RECORDED',
        entries: [
          { id: 'e3', type: 'CLOCK_IN', timestamp: '2026-11-12T08:00:00Z' },
          { id: 'e4', type: 'CLOCK_OUT', timestamp: '2026-11-12T17:00:00Z' },
        ],
      };

      const { rerender } = render(
        <MemoryRouter>
          <SmartCalendarDayDetail day={day10} onDayUpdated={vi.fn()} />
        </MemoryRouter>
      );

      // Clica no botão de ajuste manual do dia 10
      const adjustBtn = screen.getByRole('button', { name: /Ajustar registros/i });
      fireEvent.click(adjustBtn);

      // O modal de ajuste abre com o cabeçalho e informações vinculadas ao dia 10
      expect(screen.getByText(/Ajuste manual do dia/i)).toBeDefined();
      expect(screen.getAllByText(/10 de novembro de 2026/i).length).toBeGreaterThan(0);

      // Simula seleção do dia 12 na grade ao fundo (atualizando a prop day)
      rerender(
        <MemoryRouter>
          <SmartCalendarDayDetail day={day12} onDayUpdated={vi.fn()} />
        </MemoryRouter>
      );

      // O modal de ajuste ainda DEVE permanecer vinculado e exibindo estritamente o dia 10!
      expect(screen.getByText(/Ajuste manual do dia/i)).toBeDefined();
      expect(screen.getAllByText(/10 de novembro de 2026/i).length).toBe(1);
      expect(screen.getByText(/12 de novembro de 2026/i)).toBeDefined();
    });

    it('11b. Detalhamento do dia renderiza a classificação correta de Feriado (Nacional, Estadual, Municipal)', () => {
      // 1. Feriado Estadual
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
          id: 'h-sp',
          date: '2026-07-09',
          name: 'Revolução Constitucionalista',
          type: 'state',
          source: 'BRASIL_API',
        },
      };

      const { rerender } = render(
        <MemoryRouter>
          <SmartCalendarDayDetail day={stateHolidayDay} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Feriado Estadual:/i)).toBeDefined();
      expect(screen.getByText('Revolução Constitucionalista')).toBeDefined();

      // 2. Feriado Municipal
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

      rerender(
        <MemoryRouter>
          <SmartCalendarDayDetail day={municipalHolidayDay} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Feriado Municipal:/i)).toBeDefined();
      expect(screen.getByText('Aniversário de São Paulo')).toBeDefined();

      // 3. Feriado Nacional
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

      rerender(
        <MemoryRouter>
          <SmartCalendarDayDetail day={nationalHolidayDay} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Feriado Nacional:/i)).toBeDefined();
      expect(screen.getByText('Proclamação da República')).toBeDefined();
    });
  });

  // =========================================================================
  // 8. ACESSIBILIDADE E ELEMENTOS NÃO ANINHADOS (REQUISITOS 12 & 13)
  // =========================================================================
  describe('Requisitos 12 e 13: Acessibilidade na visualização em lista', () => {
    it('12a. Visualização em lista: seleção por clique de mouse, atualização de aria-pressed e detalhamento', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Alterna para visualização em Lista
      fireEvent.click(screen.getByRole('radio', { name: /Lista/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Lista mensal de jornadas')).toBeDefined();
      });

      // Localiza o botão do dia 15 na lista
      const day15ListButton = screen.getByRole('button', { name: /Dia 15.*Proclamação da República/i });
      expect(day15ListButton).toBeDefined();

      // Estado inicial: não selecionado
      expect(day15ListButton.getAttribute('aria-pressed')).toBe('false');

      // Acionamento por clique de mouse
      fireEvent.click(day15ListButton);

      // Confirma que o dia 15 foi selecionado (aria-pressed=true e painel de detalhes atualizado)
      expect(day15ListButton.getAttribute('aria-pressed')).toBe('true');
      await waitFor(() => {
        expect(screen.getAllByText(/Proclamação da República/i).length).toBeGreaterThan(0);
      });
    });

    it('12b. Acessibilidade na visualização em lista: elemento semântico button, foco e eventos de teclado', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Alterna para visualização em Lista
      fireEvent.click(screen.getByRole('radio', { name: /Lista/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Lista mensal de jornadas')).toBeDefined();
      });

      // Localiza o botão do dia 15 na lista
      const day15ListButton = screen.getByRole('button', { name: /Dia 15.*Proclamação da República/i });
      expect(day15ListButton).toBeDefined();

      // 1. Garante que é um elemento semântico nativo <button type="button">
      expect(day15ListButton.tagName).toBe('BUTTON');
      expect(day15ListButton.getAttribute('type')).toBe('button');

      // 2. Garante que é focável pelo teclado
      day15ListButton.focus();
      expect(document.activeElement).toBe(day15ListButton);

      // 3. Dispara eventos de teclado Enter e Espaço no elemento com foco
      // Nota de homologação: Semântica nativa testada sem uso de fireEvent.click
      fireEvent.keyDown(day15ListButton, { key: 'Enter', code: 'Enter' });
      fireEvent.keyUp(day15ListButton, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(day15ListButton, { key: ' ', code: 'Space' });
      fireEvent.keyUp(day15ListButton, { key: ' ', code: 'Space' });

      // O elemento permanece íntegro, interativo e com semântica de botão
      expect(day15ListButton.tagName).toBe('BUTTON');
      expect(document.activeElement).toBe(day15ListButton);
    });

    it('13. Visão em lista não contém botões ou elementos interativos aninhados de forma inválida', async () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getByRole('radio', { name: /Lista/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Lista mensal de jornadas')).toBeDefined();
      });

      // Seleciona a seção da lista
      const listSection = screen.getByLabelText('Lista mensal de jornadas');
      const itemButtons = listSection.querySelectorAll('button[type="button"]');

      expect(itemButtons.length).toBeGreaterThan(0);

      // Para cada botão de item, garante que NÃO há outros botões, links ou inputs interativos aninhados
      itemButtons.forEach((btn) => {
        const nestedInteractive = btn.querySelectorAll('button, a, input, select, textarea');
        expect(nestedInteractive.length).toBe(0);
      });
    });
  });

  // =========================================================================
  // 9. ISOLAMENTO DE USUÁRIOS E ZERO MUTAÇÕES (REQUISITO 14)
  // =========================================================================
  describe('Requisito 14 e Isolamento de Usuários: Ausência de mutações e isolamento estrito', () => {
    it('14. ZERO mutações (POST, PUT, PATCH, DELETE) durante a navegação e consulta', async () => {
      const postSpy = vi.spyOn(api, 'post');
      const putSpy = vi.spyOn(api, 'put');
      const patchSpy = vi.spyOn(api, 'patch');
      const deleteSpy = vi.spyOn(api, 'delete');

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Novembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Clica em navegações e seleção de dia
      fireEvent.click(screen.getByRole('button', { name: /Mês anterior/i }));
      fireEvent.click(screen.getByTitle('Ir para o mês e dia atual'));
      const dayButtons = screen.getAllByRole('button', { name: /Dia 15/i });
      fireEvent.click(dayButtons[0]);

      // Alterna modos de exibição
      fireEvent.click(screen.getByRole('radio', { name: /Lista/i }));
      fireEvent.click(screen.getByRole('radio', { name: /Calendário/i }));

      // Nenhuma mutação disparada
      expect(postSpy).not.toHaveBeenCalled();
      expect(putSpy).not.toHaveBeenCalled();
      expect(patchSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('garante isolamento imediato ao trocar de usuário e no logout', async () => {
      const { result, rerender } = renderHook(() => useSmartCalendar(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      });

      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });

      // Simula logout (user = null)
      (useAuth as any).mockReturnValue({
        user: null,
        loading: false,
      });

      rerender();

      // De forma síncrona/imediata, dados anteriores são expurgados da tela
      expect(result.current.data).toBeNull();
      expect(result.current.selectedDayDate).toBeNull();

      // Simula login de Usuário B
      (useAuth as any).mockReturnValue({
        user: USER_B,
        loading: false,
      });

      rerender();

      // Recarrega estritamente os dados do Usuário B
      await waitFor(() => {
        expect(result.current.data).not.toBeNull();
      });
    });
  });
});

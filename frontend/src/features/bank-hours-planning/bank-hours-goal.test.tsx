// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, renderHook, act } from '@testing-library/react';
import React from 'react';
import { BankHoursPlanningCard } from './BankHoursPlanningCard';
import { useBankHoursGoal } from './useBankHoursGoal';
import { useAuth } from '../../contexts/AuthContext';
import { settingsService } from '../../services/settings.service';
import { holidayService } from '../../services/holiday.service';
import { calendarOccurrenceService } from '../../services/calendar-occurrence.service';
import { api } from '../../services/api';
import { getActiveGoal, saveActiveGoal, clearActiveGoal } from './goal-storage';
import { SavedBankHoursGoal } from './types';

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

describe('BankHoursGoal — Homologação da Subetapa 12.5.1', () => {
  const USER_A = { id: 'user_alpha', name: 'Colaborador Alpha' };
  const USER_B = { id: 'user_beta', name: 'Colaborador Beta' };
  const TODAY_STR = '2026-11-15';

  const mockSettings = {
    profile: { name: 'Colaborador Alpha', email: 'alpha@horacerta.local' },
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
    localStorage.clear();
    vi.clearAllMocks();

    (useAuth as any).mockReturnValue({
      user: USER_A,
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
    localStorage.clear();
  });

  // =========================================================================
  // CENÁRIO 1: PREVISÃO DA META SALVA INDEPENDENTE DO SIMULADOR TEMPORÁRIO
  // =========================================================================
  describe('Cenário 1: Previsão da meta salva desacoplada da simulação temporária', () => {
    it('mantém o cálculo da meta salva inalterado ao mexer no simulador e recalcula quando o saldo oficial muda', async () => {
      // 1. Renderiza o card com saldo inicial de -240 min (-04h00)
      const { rerender } = render(
        <BankHoursPlanningCard
          currentBalanceMinutes={-240}
          todayStr={TODAY_STR}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Resultado da Simulação')).toBeDefined();
      });

      // 2. Salva a simulação atual como meta ativa (prazo default 2026-12-15, saldo objetivo 00:00)
      const saveBtn = screen.getByRole('button', { name: /Salvar como meta ativa/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Meta salva com sucesso/i)).toBeDefined();
        expect(screen.getByText('Saldo Inicial (Criação)')).toBeDefined();
        expect(screen.getAllByText(/15 de dezembro de 2026/i).length).toBeGreaterThan(0);
      });

      // Aguarda o forecast independente da meta ser calculado e confere numericamente
      await waitFor(() => {
        expect(screen.getByText(/22 dias úteis restantes/i)).toBeDefined();
        expect(screen.getByText(/\+11 min\/dia útil/i)).toBeDefined();
      });

      // Confirma que a meta ativa exibe prazo de 15 de dezembro de 2026 e saldo objetivo de 00h 00min
      expect(screen.getByText('Saldo Objetivo')).toBeDefined();

      // 3. Modifica a meta de saldo no simulador para +03:00 (+180 min)
      const targetBalanceInput = screen.getByLabelText(/Meta de saldo desejada/i);
      fireEvent.change(targetBalanceInput, { target: { value: '+03:00' } });

      // 4. Modifica o prazo no simulador temporário abrindo o datepicker e escolhendo o dia 22
      const datePickerTrigger = screen.getByText('15/12/2026');
      fireEvent.click(datePickerTrigger);
      const day22Buttons = screen.getAllByRole('button', { name: '22' });
      if (day22Buttons.length > 0) {
        fireEvent.click(day22Buttons[day22Buttons.length - 1]);
      }

      // 5. Verifica que o simulador temporário atualizou para a nova meta (+03:00)
      await waitFor(() => {
        expect(screen.getByText('meta: +03h00')).toBeDefined();
      });

      // 6. Verifica que o card da meta ativa MANTÉM seus dados originais intactos:
      // Saldo objetivo da meta salva continua 00h 00min (não virou +03:00)
      // Prazo da meta salva continua 15 de dezembro de 2026
      // Previsão independente continua com 22 dias úteis e +11 min/dia útil
      expect(screen.getByText('Saldo Inicial (Criação)')).toBeDefined();
      expect(screen.getByText('Zerar Saldo Devedor')).toBeDefined();
      expect(screen.getAllByText(/15 de dezembro de 2026/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/22 dias úteis restantes/i)).toBeDefined();
      expect(screen.getByText(/\+11 min\/dia útil/i)).toBeDefined();

      // 7. Atualiza o saldo oficial de -240 para -180 min via props
      rerender(
        <BankHoursPlanningCard
          currentBalanceMinutes={-180}
          todayStr={TODAY_STR}
        />
      );

      // 8. Confirma que a meta ativa recalculou dinamicamente com base no novo saldo oficial:
      // Restante a compensar diminuiu para 3h 00min (180 min restantes para zerar)
      // Progresso evoluiu para 25% (60 min compensados de 240 min)
      // Previsão diária atualizou para +9 min/dia útil (180 min / 22 dias = 8.18 -> 9 min)
      await waitFor(() => {
        expect(screen.getByText('25%')).toBeDefined();
        expect(screen.getByText('Em Andamento')).toBeDefined();
        expect(screen.getAllByText('3h 00min').length).toBeGreaterThan(0);
        expect(screen.getByText(/22 dias úteis restantes/i)).toBeDefined();
        expect(screen.getByText(/\+9 min\/dia útil/i)).toBeDefined();
      });
    });
  });

  // =========================================================================
  // CENÁRIO 2: ISOLAMENTO IMEDIATO ENTRE USUÁRIOS
  // =========================================================================
  describe('Cenário 2: Isolamento imediato e síncrono entre usuários', () => {
    it('garante isolamento estrito síncrono via hook useBankHoursGoal', () => {
      // Pré-configura metas distintas no storage
      const goalUserA: SavedBankHoursGoal = {
        id: 'goal_alpha_1',
        userId: USER_A.id,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-12-20',
        mode: 'TARGET_DATE',
        baselineBalanceMinutes: -240,
        createdAtStr: TODAY_STR,
        createdAtTimestamp: 1000,
      };

      const goalUserB: SavedBankHoursGoal = {
        id: 'goal_beta_1',
        userId: USER_B.id,
        targetBalanceMinutes: 120,
        targetDateStr: '2026-12-31',
        mode: 'TARGET_DATE',
        baselineBalanceMinutes: -60,
        createdAtStr: TODAY_STR,
        createdAtTimestamp: 2000,
      };

      saveActiveGoal(USER_A.id, goalUserA);
      saveActiveGoal(USER_B.id, goalUserB);

      // Inicia renderização para Usuário A com saldo -240
      const { result, rerender } = renderHook(
        (props: { userId: string; balance: number }) =>
          useBankHoursGoal({
            userId: props.userId,
            currentBalanceMinutes: props.balance,
            todayStr: TODAY_STR,
          }),
        {
          initialProps: { userId: USER_A.id, balance: -240 },
        }
      );

      // Usuário A deve ver estritamente sua própria meta
      expect(result.current.hasActiveGoal).toBe(true);
      expect(result.current.activeGoal?.userId).toBe(USER_A.id);
      expect(result.current.activeGoal?.id).toBe('goal_alpha_1');
      expect(result.current.progress?.remainingMinutes).toBe(240);

      // Alterna IMEDIATAMENTE para Usuário B com saldo -60
      rerender({ userId: USER_B.id, balance: -60 });

      // Verificação SÍNCRONA: Usuário B recebe estritamente a meta do Usuário B,
      // NUNCA calculando a meta do Usuário A com saldo do Usuário B
      expect(result.current.activeGoal?.userId).toBe(USER_B.id);
      expect(result.current.activeGoal?.id).toBe('goal_beta_1');
      expect(result.current.progress?.remainingMinutes).toBe(180); // de -60 para +120 = 180 min

      // Alterna IMEDIATAMENTE para logout (userId = '')
      rerender({ userId: '', balance: 0 });

      // Verificação SÍNCRONA: desautenticado não expõe nenhuma meta ativa
      expect(result.current.hasActiveGoal).toBe(false);
      expect(result.current.activeGoal).toBeNull();
      expect(result.current.progress).toBeNull();
      expect(result.current.forecast).toBeNull();

      // Alterna de volta para Usuário A: meta íntegra restaurada
      rerender({ userId: USER_A.id, balance: -120 });
      expect(result.current.hasActiveGoal).toBe(true);
      expect(result.current.activeGoal?.userId).toBe(USER_A.id);
      expect(result.current.progress?.remainingMinutes).toBe(120);
      expect(result.current.progress?.progressPercentage).toBe(50); // de -240 para -120 = 50%
    });

    it('impede vazamento visual síncrono no componente BankHoursPlanningCard durante troca de usuário', async () => {
      // Usuário A possui meta salva
      const goalUserA: SavedBankHoursGoal = {
        id: 'goal_alpha_card',
        userId: USER_A.id,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-12-15',
        mode: 'TARGET_DATE',
        baselineBalanceMinutes: -300,
        createdAtStr: TODAY_STR,
        createdAtTimestamp: 1000,
      };
      saveActiveGoal(USER_A.id, goalUserA);

      // Renderiza com Usuário A
      const { rerender } = render(
        <BankHoursPlanningCard
          currentBalanceMinutes={-300}
          todayStr={TODAY_STR}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Saldo Inicial (Criação)')).toBeDefined();
        expect(screen.getAllByText('-05h00').length).toBeGreaterThan(0);
      });

      // Simula alteração do contexto de autenticação para Usuário B (que não tem meta)
      (useAuth as any).mockReturnValue({
        user: USER_B,
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

      // Verificação síncrona: o card da meta do Usuário A foi removido da tela
      expect(screen.queryByText('Saldo Inicial (Criação)')).toBeNull();
      expect(screen.queryByText('Meta de Compensação Ativa')).toBeNull();

      // Volta para Usuário A: card reaparece
      (useAuth as any).mockReturnValue({
        user: USER_A,
        loading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshMe: vi.fn(),
      });

      rerender(
        <BankHoursPlanningCard
          currentBalanceMinutes={-300}
          todayStr={TODAY_STR}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Saldo Inicial (Criação)')).toBeDefined();
      });
    });
  });

  // =========================================================================
  // CENÁRIO 3: TRATAMENTO DE INDISPONIBILIDADE DO CALENDÁRIO DA META
  // =========================================================================
  describe('Cenário 3: Resiliência contra indisponibilidade de calendário', () => {
    it('exibe o progresso oficial com aviso discreto quando o calendário falha, sem inventar dias fictícios, e permite retry', async () => {
      // Salva meta para Usuário A
      const goalUserA: SavedBankHoursGoal = {
        id: 'goal_alpha_err',
        userId: USER_A.id,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-12-15',
        mode: 'TARGET_DATE',
        baselineBalanceMinutes: -240,
        createdAtStr: TODAY_STR,
        createdAtTimestamp: 1000,
      };
      saveActiveGoal(USER_A.id, goalUserA);

      // Simula falha de serviço no calendário da meta
      (settingsService.getSettings as any).mockRejectedValue(
        new Error('Conexão perdida')
      );

      render(
        <BankHoursPlanningCard
          currentBalanceMinutes={-240}
          todayStr={TODAY_STR}
        />
      );

      // O progresso oficial continua perfeitamente visível (pois usa o saldo do banco)
      await waitFor(() => {
        expect(screen.getByText('Saldo Oficial Atual')).toBeDefined();
        expect(screen.getByText('Restante a Compensar')).toBeDefined();
      });

      // Aviso discreto é renderizado no tracker sem quebrar o componente e sem inventar dias úteis
      await waitFor(() => {
        expect(
          screen.getByText(
            /Previsão temporariamente indisponível \(não foi possível carregar o calendário da meta\)/i
          )
        ).toBeDefined();
      });

      // Botão "Tentar novamente" está presente
      const retryBtns = screen.getAllByRole('button', { name: /Tentar novamente/i });
      expect(retryBtns.length).toBeGreaterThan(0);

      // Restaura o serviço para funcionar na nova tentativa
      (settingsService.getSettings as any).mockResolvedValue(mockSettings);

      // Clica em Tentar novamente
      fireEvent.click(retryBtns[0]);

      // Previsão se recupera com sucesso
      await waitFor(() => {
        expect(screen.getByText(/dias úteis restantes/i)).toBeDefined();
      });
    });
  });

  // =========================================================================
  // CENÁRIO 4: METAS CONCLUÍDAS E VENCIDAS
  // =========================================================================
  describe('Cenário 4: Metas concluídas e vencidas suprimem compensação futura', () => {
    it('suprime previsão futura e exibe parabéns quando a meta é concluída (COMPLETED)', async () => {
      const goalUserA: SavedBankHoursGoal = {
        id: 'goal_completed_test',
        userId: USER_A.id,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-12-15',
        mode: 'TARGET_DATE',
        baselineBalanceMinutes: -120,
        createdAtStr: TODAY_STR,
        createdAtTimestamp: 1000,
      };
      saveActiveGoal(USER_A.id, goalUserA);

      // Saldo já alcançou o objetivo de 0 min
      render(
        <BankHoursPlanningCard
          currentBalanceMinutes={0}
          todayStr={TODAY_STR}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Meta Concluída')).toBeDefined();
        expect(screen.getByText('100%')).toBeDefined();
        expect(
          screen.getByText(
            /Parabéns! Sua meta de saldo foi alcançada com base na apuração oficial consolidada/i
          )
        ).toBeDefined();
      });

      // Não exibe texto de acréscimo diário futuro
      expect(screen.queryByText(/min\/dia útil a partir de hoje/i)).toBeNull();
    });

    it('suprime previsão futura e exibe aviso de prazo expirado quando a data passou (EXPIRED)', async () => {
      const goalUserA: SavedBankHoursGoal = {
        id: 'goal_expired_test',
        userId: USER_A.id,
        targetBalanceMinutes: 0,
        targetDateStr: '2026-11-10', // Venceu antes de hoje (2026-11-15)
        mode: 'TARGET_DATE',
        baselineBalanceMinutes: -180,
        createdAtStr: '2026-11-01',
        createdAtTimestamp: 1000,
      };
      saveActiveGoal(USER_A.id, goalUserA);

      render(
        <BankHoursPlanningCard
          currentBalanceMinutes={-180}
          todayStr={TODAY_STR}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Prazo Expirado')).toBeDefined();
        expect(
          screen.getByText(/O prazo limite definido para esta meta encerrou em/i)
        ).toBeDefined();
      });

      // Não exibe previsão futura de compensação
      expect(screen.queryByText(/min\/dia útil a partir de hoje/i)).toBeNull();
    });
  });

  // =========================================================================
  // CENÁRIO 5: ZERO MUTAÇÕES NA API DO BACKEND
  // =========================================================================
  describe('Cenário 5: Inexistência de chamadas de escrita no backend', () => {
    it('garante zero chamadas POST, PUT, PATCH ou DELETE ao salvar, atualizar e descartar meta', async () => {
      const postSpy = vi.spyOn(api, 'post');
      const putSpy = vi.spyOn(api, 'put');
      const patchSpy = vi.spyOn(api, 'patch');
      const deleteSpy = vi.spyOn(api, 'delete');

      const { rerender } = render(
        <BankHoursPlanningCard
          currentBalanceMinutes={-240}
          todayStr={TODAY_STR}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Resultado da Simulação')).toBeDefined();
      });

      // Salva meta
      fireEvent.click(screen.getByRole('button', { name: /Salvar como meta ativa/i }));
      await waitFor(() => {
        expect(screen.getByText('Saldo Inicial (Criação)')).toBeDefined();
      });

      // Atualiza saldo
      rerender(
        <BankHoursPlanningCard
          currentBalanceMinutes={-120}
          todayStr={TODAY_STR}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeDefined();
      });

      // Descarta meta
      fireEvent.click(screen.getByLabelText('Encerrar meta'));
      fireEvent.click(screen.getByRole('button', { name: 'Sim' }));

      await waitFor(() => {
        expect(screen.queryByText('Saldo Inicial (Criação)')).toBeNull();
      });

      // Comprova estritamente que nenhuma mutação ocorreu no backend
      expect(postSpy).not.toHaveBeenCalled();
      expect(putSpy).not.toHaveBeenCalled();
      expect(patchSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});

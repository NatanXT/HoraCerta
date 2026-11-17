// @vitest-environment happy-dom
import React, { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { RemindersProvider, useReminders } from './RemindersContext';
import { workSessionService } from '../../services/work-session.service';
import { profileService } from '../../services/profile.service';
import { RemindersCrossTabCoordinator } from './reminders-delivery';
import * as AuthContextModule from '../../contexts/AuthContext';
import { DEFAULT_REMINDER_SETTINGS } from './types';
import { loadDispatchedReminders } from './reminders-storage';
import { evaluateReminders } from './reminders-evaluator';

// Mock external services
vi.mock('../../services/work-session.service', () => ({
  workSessionService: {
    getToday: vi.fn(),
  },
}));

vi.mock('../../services/profile.service', () => ({
  profileService: {
    getProfile: vi.fn(),
  },
}));

// Test Consumer component to inspect and invoke RemindersContext
const ConsumerComponent: React.FC<{
  onStateChange?: (ctx: ReturnType<typeof useReminders>) => void;
}> = ({ onStateChange }) => {
  const context = useReminders();
  React.useEffect(() => {
    onStateChange?.(context);
  }, [context, onStateChange]);

  return (
    <div>
      <span data-testid="enabled">{String(context.settings.enabled)}</span>
      <span data-testid="entry-lead">{context.settings.entryLeadMinutes}</span>
      <span data-testid="next-reminder">{context.nextReminder?.title || 'NONE'}</span>
      <span data-testid="next-trigger">{context.nextReminder?.triggerTimeFormatted || 'NONE'}</span>
      <span data-testid="next-target">{context.nextReminder?.targetTimeFormatted || 'NONE'}</span>
      <span data-testid="next-type">{context.nextReminder?.type || 'NONE'}</span>
      <span data-testid="permission">{context.browserPermission}</span>
      <button
        data-testid="btn-update-30"
        onClick={() => {
          context.saveSettings({
            ...context.settings,
            entryLeadMinutes: 30,
          });
        }}
      >
        Set 30
      </button>
      <button
        data-testid="btn-disable"
        onClick={() => {
          context.saveSettings({
            ...context.settings,
            enabled: false,
          });
        }}
      >
        Disable
      </button>
    </div>
  );
};

describe('RemindersProvider — Real React Provider Integration Suite', () => {
  let currentUser: { id: string; name: string } | null = { id: 'user_1', name: 'User 1' };
  let storageMap: Map<string, string>;

  // Monday 2026-11-16 at 07:20:00 (planned start is 08:00)
  const FIXED_TEST_DATE = new Date(2026, 10, 16, 7, 20, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_TEST_DATE);

    storageMap = new Map();

    const mockLocalStorage: Storage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storageMap.set(k, String(v));
      },
      removeItem: (k: string) => {
        storageMap.delete(k);
      },
      clear: () => {
        storageMap.clear();
      },
      key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
      length: 0,
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      writable: true,
      configurable: true,
    });

    currentUser = { id: 'user_1', name: 'User 1' };

    vi.spyOn(AuthContextModule, 'useAuth').mockImplementation(() => ({
      user: currentUser as any,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshMe: vi.fn(),
    }));

    vi.mocked(profileService.getProfile).mockResolvedValue({
      id: 'user_1',
      name: 'User 1',
      email: 'user1@test.com',
      workSchedule: {
        id: 'ws-1',
        name: 'Horário Padrão',
        weeklyHours: 40,
        days: [
          {
            weekday: 'MONDAY',
            expectedMinutes: 480,
            plannedStartMinutes: 480, // 08:00
            plannedEndMinutes: 1035,
            snackBreakMinutes: 15,
            lunchBreakMinutes: 60,
          },
        ],
      },
    } as any);

    vi.mocked(workSessionService.getToday).mockResolvedValue({
      date: '2026-11-16',
      expectedMinutes: 480,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: -480,
      isOpen: false,
      entries: [],
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Montagem com React StrictMode e Verificação de Listeners
  // -------------------------------------------------------------------------
  it('1. monta em StrictMode registrando e limpando listeners de foco/visibilidade corretamente', async () => {
    const windowFocusAdded: Array<EventListenerOrEventListenerObject> = [];
    const windowFocusRemoved: Array<EventListenerOrEventListenerObject> = [];
    const docVisAdded: Array<EventListenerOrEventListenerObject> = [];
    const docVisRemoved: Array<EventListenerOrEventListenerObject> = [];

    const origWinAdd = window.addEventListener.bind(window);
    const origWinRemove = window.removeEventListener.bind(window);
    const origDocAdd = document.addEventListener.bind(document);
    const origDocRemove = document.removeEventListener.bind(document);

    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'focus') windowFocusAdded.push(listener);
      return origWinAdd(type, listener, options);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (type === 'focus') windowFocusRemoved.push(listener);
      return origWinRemove(type, listener, options);
    });
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'visibilitychange') docVisAdded.push(listener);
      return origDocAdd(type, listener, options);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (type === 'visibilitychange') docVisRemoved.push(listener);
      return origDocRemove(type, listener, options);
    });

    let latestCtx: ReturnType<typeof useReminders> | undefined;

    const { getByTestId, unmount } = render(
      <StrictMode>
        <RemindersProvider>
          <ConsumerComponent onStateChange={(c) => (latestCtx = c)} />
        </RemindersProvider>
      </StrictMode>
    );

    await waitFor(() => {
      expect(getByTestId('enabled').textContent).toBe(String(DEFAULT_REMINDER_SETTINGS.enabled));
    });

    expect(latestCtx).toBeDefined();

    // Ativa lembretes para acionar listeners periódicos
    act(() => {
      latestCtx!.saveSettings({
        ...DEFAULT_REMINDER_SETTINGS,
        enabled: true,
      });
    });

    await waitFor(() => {
      expect(getByTestId('enabled').textContent).toBe('true');
    });

    // Desmonta componente
    unmount();

    // Confirma que os event listeners foram balanceados e removidos com as mesmas referências
    expect(windowFocusAdded.length).toBeGreaterThanOrEqual(1);
    expect(windowFocusRemoved.length).toBe(windowFocusAdded.length);
    for (const addedListener of windowFocusAdded) {
      expect(windowFocusRemoved).toContain(addedListener);
    }

    expect(docVisAdded.length).toBeGreaterThanOrEqual(1);
    expect(docVisRemoved.length).toBe(docVisAdded.length);
    for (const addedListener of docVisAdded) {
      expect(docVisRemoved).toContain(addedListener);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Mudança de permissão de navegador não reconstrói o coordenador
  // -------------------------------------------------------------------------
  it('2. chamada de requestPermission não chama destroy nem reconstrói o coordenador entre abas', async () => {
    const destroySpy = vi.spyOn(RemindersCrossTabCoordinator.prototype, 'destroy');

    let latestCtx: ReturnType<typeof useReminders> | undefined;

    const { getByTestId } = render(
      <RemindersProvider>
        <ConsumerComponent onStateChange={(c) => (latestCtx = c)} />
      </RemindersProvider>
    );

    await waitFor(() => expect(latestCtx).toBeDefined());

    // Limpa chamadas de destroy decorrentes da montagem inicial
    destroySpy.mockClear();

    await act(async () => {
      const res = await latestCtx!.requestPermission();
      expect(res).toBe('granted');
    });

    await waitFor(() => {
      expect(getByTestId('permission').textContent).toBe('granted');
    });

    // A mudança de permissão NÃO deve ter chamado destroy() no coordenador
    expect(destroySpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Cenário Obrigatório Conclusivo: 10min -> 30min -> Cálculo Real de Trigger
  // -------------------------------------------------------------------------
  it('3. cenário obrigatório: alteração de 10 para 30 min invalida avaliação antiga e calcula trigger 07:30', async () => {
    let latestCtx: ReturnType<typeof useReminders> | undefined;

    const { getByTestId } = render(
      <RemindersProvider>
        <ConsumerComponent onStateChange={(c) => (latestCtx = c)} />
      </RemindersProvider>
    );

    await waitFor(() => expect(latestCtx).toBeDefined());

    // 1. Configura inicialmente para ativado com 10 min de antecedência
    act(() => {
      latestCtx!.saveSettings({
        ...DEFAULT_REMINDER_SETTINGS,
        enabled: true,
        entryEnabled: true,
        entryLeadMinutes: 10,
      });
    });

    // Às 07:20 com 10 min de antecedência para expediente às 08:00 -> aviso às 07:50
    await waitFor(() => {
      expect(getByTestId('entry-lead').textContent).toBe('10');
      expect(getByTestId('next-type').textContent).toBe('ENTRY');
      expect(getByTestId('next-trigger').textContent).toBe('07:50');
      expect(getByTestId('next-target').textContent).toBe('08:00');
    });

    // 2. Prepara promessa controlada para simular latência de rede
    let resolveSlowPromise!: (val: any) => void;
    let promiseStarted = false;

    vi.mocked(workSessionService.getToday).mockImplementation(
      () =>
        new Promise((resolve) => {
          promiseStarted = true;
          resolveSlowPromise = resolve;
        })
    );

    // 3. Usuário altera para 30 minutos e clica salvar
    act(() => {
      getByTestId('btn-update-30').click();
    });

    // Confirma que a busca assíncrona foi iniciada
    await waitFor(() => {
      expect(promiseStarted).toBe(true);
      expect(resolveSlowPromise).toBeDefined();
    });

    // 4. Resolve a requisição dentro de act assíncrono
    await act(async () => {
      resolveSlowPromise({
        date: '2026-11-16',
        expectedMinutes: 480,
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: -480,
        isOpen: false,
        entries: [],
      });
    });

    // 5. O lembrete DEVE ter sido recalculado com 30 min de antecedência:
    // Às 07:20 com 30 min de antecedência para expediente às 08:00 -> aviso às 07:30!
    await waitFor(() => {
      expect(getByTestId('entry-lead').textContent).toBe('30');
      expect(getByTestId('next-trigger').textContent).toBe('07:30');
      expect(getByTestId('next-target').textContent).toBe('08:00');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Desativação limpa imediatamente e descarta avaliação pendente
  // -------------------------------------------------------------------------
  it('4. desativação limpa imediatamente nextReminder e descarta resolução pendente de getToday', async () => {
    let latestCtx: ReturnType<typeof useReminders> | undefined;

    const { getByTestId } = render(
      <RemindersProvider>
        <ConsumerComponent onStateChange={(c) => (latestCtx = c)} />
      </RemindersProvider>
    );

    await waitFor(() => expect(latestCtx).toBeDefined());

    // Ativa inicialmente
    act(() => {
      latestCtx!.saveSettings({
        ...DEFAULT_REMINDER_SETTINGS,
        enabled: true,
        entryEnabled: true,
        entryLeadMinutes: 10,
      });
    });

    await waitFor(() => {
      expect(getByTestId('next-trigger').textContent).toBe('07:50');
    });

    // Prepara promessa controlada
    let resolvePending!: (val: any) => void;
    let promiseStarted = false;

    vi.mocked(workSessionService.getToday).mockImplementation(
      () =>
        new Promise((resolve) => {
          promiseStarted = true;
          resolvePending = resolve;
        })
    );

    // Inicia uma avaliação com enabled = true
    act(() => {
      latestCtx!.evaluateNow();
    });

    // Confirma que a busca assíncrona foi iniciada e está pendente em voo
    await waitFor(() => {
      expect(promiseStarted).toBe(true);
      expect(resolvePending).toBeDefined();
    });

    // Enquanto getToday está pendente em voo, o usuário desativa os lembretes
    act(() => {
      getByTestId('btn-disable').click();
    });

    // nextReminder deve ir para NONE imediatamente
    expect(getByTestId('next-reminder').textContent).toBe('NONE');
    expect(getByTestId('enabled').textContent).toBe('false');

    // Resolve a promessa tardiamente
    await act(async () => {
      resolvePending({
        date: '2026-11-16',
        expectedMinutes: 480,
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: -480,
        isOpen: false,
        entries: [],
      });
    });

    // nextReminder permanece estritamente NONE (não reativa)
    expect(getByTestId('next-reminder').textContent).toBe('NONE');
  });

  // -------------------------------------------------------------------------
  // 5. Logout durante requisição pendente cancela dados da conta anterior
  // -------------------------------------------------------------------------
  it('5. logout ou troca de usuário durante requisição pendente cancela o processamento anterior', async () => {
    let latestCtx: ReturnType<typeof useReminders> | undefined;

    const { getByTestId, rerender } = render(
      <RemindersProvider>
        <ConsumerComponent onStateChange={(c) => (latestCtx = c)} />
      </RemindersProvider>
    );

    await waitFor(() => expect(latestCtx).toBeDefined());

    // Ativa
    act(() => {
      latestCtx!.saveSettings({
        ...DEFAULT_REMINDER_SETTINGS,
        enabled: true,
        entryEnabled: true,
        entryLeadMinutes: 10,
      });
    });

    let resolveSlowUser1!: (val: any) => void;
    let promiseStarted = false;

    vi.mocked(workSessionService.getToday).mockImplementation(
      () =>
        new Promise((resolve) => {
          promiseStarted = true;
          resolveSlowUser1 = resolve;
        })
    );

    // Dispara nova avaliação
    act(() => {
      latestCtx!.evaluateNow();
    });

    await waitFor(() => {
      expect(promiseStarted).toBe(true);
      expect(resolveSlowUser1).toBeDefined();
    });

    // Usuário desloga
    currentUser = null;
    rerender(
      <RemindersProvider>
        <ConsumerComponent onStateChange={(c) => (latestCtx = c)} />
      </RemindersProvider>
    );

    // Estado limpo imediatamente
    expect(getByTestId('next-reminder').textContent).toBe('NONE');

    // Resposta de user 1 resolve após o logout
    await act(async () => {
      resolveSlowUser1({
        date: '2026-11-16',
        expectedMinutes: 480,
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: -480,
        isOpen: false,
        entries: [],
      });
    });

    // Nenhuma informação vaza para a sessão vazia
    expect(getByTestId('next-reminder').textContent).toBe('NONE');
  });

  // -------------------------------------------------------------------------
  // 6. Alinhamento de Fuso Horário Próximo à Meia-Noite com Teste Conclusivo
  // -------------------------------------------------------------------------
  it('6. alinha dia da semana com a data civil do fuso horário configurado mesmo com relógio local após meia-noite', async () => {
    // Instante UTC fixo: 2026-11-17T01:30:00.000Z
    // No fuso oficial America/Sao_Paulo (UTC-3), isso corresponde exatamente a:
    // Segunda-feira, 2026-11-16, às 22h30m00s.
    const lateNightUtc = new Date('2026-11-17T01:30:00.000Z');
    vi.setSystemTime(lateNightUtc);

    // Perfil do usuário com jornadas distintas para segunda e terça:
    // Segunda-feira (MONDAY): entrada às 22:40 (1360 min)
    // Terça-feira (TUESDAY): entrada às 08:00 (480 min)
    vi.mocked(profileService.getProfile).mockResolvedValue({
      id: 'user_1',
      name: 'User 1',
      email: 'user1@test.com',
      workSchedule: {
        id: 'ws-1',
        name: 'Horário Diferenciado',
        weeklyHours: 40,
        days: [
          {
            weekday: 'MONDAY',
            expectedMinutes: 480,
            plannedStartMinutes: 1360, // 22:40
            plannedEndMinutes: 1840,
            snackBreakMinutes: 15,
            lunchBreakMinutes: 60,
          },
          {
            weekday: 'TUESDAY',
            expectedMinutes: 480,
            plannedStartMinutes: 480, // 08:00
            plannedEndMinutes: 1020,
            snackBreakMinutes: 15,
            lunchBreakMinutes: 60,
          },
        ],
      },
    } as any);

    // Nenhuma entrada registrada no dia 2026-11-16 (Segunda-feira)
    vi.mocked(workSessionService.getToday).mockResolvedValue({
      date: '2026-11-16',
      expectedMinutes: 480,
      workedMinutes: 0,
      currentSessionMinutes: 0,
      totalWorkedMinutes: 0,
      balanceMinutes: -480,
      isOpen: false,
      entries: [],
    } as any);

    let latestCtx: ReturnType<typeof useReminders> | undefined;

    const { findByText } = render(
      <RemindersProvider>
        <ConsumerComponent onStateChange={(c) => (latestCtx = c)} />
      </RemindersProvider>
    );

    await waitFor(() => expect(latestCtx).toBeDefined());

    // Configura lembretes ativados com antecedência de 15 minutos para entrada
    act(() => {
      latestCtx!.saveSettings({
        ...DEFAULT_REMINDER_SETTINGS,
        enabled: true,
        entryEnabled: true,
        entryLeadMinutes: 15, // Alerta nominal em 22:25 para entrada nominal em 22:40
      });
    });

    // 1. O alerta deve ser efetivamente disparado e exibido via toast na interface
    // (às 22:30, o aviso programado para 22:25 está dentro da janela de relevância de 30 min)
    const toastTitle = await findByText('Horário de Entrada');
    expect(toastTitle).toBeDefined();

    // 2. Confirma que o item foi despachado no storage com o ID correto da segunda-feira e 22:40 (1360 min)
    const dispatched = loadDispatchedReminders('user_1');
    expect(dispatched.length).toBe(1);
    expect(dispatched[0].id).toBe('user_1_2026-11-16_ENTRY_1360_15');
    expect(dispatched[0].type).toBe('ENTRY');
    expect(dispatched[0].dateStr).toBe('2026-11-16');

    // 3. Validação matemática pelo avaliador de que os horários respeitam America/Sao_Paulo:
    const evalResult = evaluateReminders({
      settings: {
        ...DEFAULT_REMINDER_SETTINGS,
        enabled: true,
        entryEnabled: true,
        entryLeadMinutes: 15,
      },
      userId: 'user_1',
      dateStr: '2026-11-16',
      workDay: {
        date: '2026-11-16',
        expectedMinutes: 480,
        workedMinutes: 0,
        currentSessionMinutes: 0,
        totalWorkedMinutes: 0,
        balanceMinutes: -480,
        isOpen: false,
        entries: [],
      } as any,
      scheduleDay: {
        weekday: 'MONDAY',
        expectedMinutes: 480,
        plannedStartMinutes: 1360,
        plannedEndMinutes: 1840,
        snackBreakMinutes: 15,
        lunchBreakMinutes: 60,
      },
      now: lateNightUtc,
    });

    expect(evalResult.allScheduled.length).toBe(1);
    const entryReminder = evalResult.allScheduled[0];
    // Evento nominal de entrada: 22h40
    expect(entryReminder.targetTimeFormatted).toBe('22:40');
    // Horário nominal do aviso (22:40 - 15min): 22h25
    expect(entryReminder.triggerTimeFormatted).toBe('22:25');
    // Alerta dentro da janela de relevância:
    expect(evalResult.readyToTrigger.length).toBe(1);
    expect(evalResult.readyToTrigger[0].id).toBe('user_1_2026-11-16_ENTRY_1360_15');
  });
});

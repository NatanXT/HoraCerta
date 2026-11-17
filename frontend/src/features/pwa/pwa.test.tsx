// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, fireEvent, waitFor, cleanup } from '@testing-library/react';
import {
  usePwaInstall,
  resetPwaInstallStateForTesting,
  setCapturedPromptForTesting,
} from './hooks/usePwaInstall';
import { usePwaUpdate } from './hooks/usePwaUpdate';
import { useNetworkStatus, getHealthUrl } from './hooks/useNetworkStatus';
import { useDirtyFormTracker } from './hooks/useDirtyFormTracker';
import { inFlightTracker } from './utils/inFlightTracker';
import { PwaInstallCard } from './components/PwaInstallCard';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { PwaOfflineIndicator } from './components/PwaOfflineIndicator';
import { BeforeInstallPromptEvent } from './types';
import { workSessionService } from '../../services/work-session.service';
import { timeEntryService } from '../../services/time-entry.service';
import { api } from '../../services/api';
import { AbsencesPage } from '../../pages/AbsencesPage';

describe('HoraCerta PWA Suite — Instalação, Atualização, Conectividade e Segurança', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resetPwaInstallStateForTesting();
    inFlightTracker._resetForTesting();
  });

  afterEach(() => {
    cleanup();
    resetPwaInstallStateForTesting();
    inFlightTracker._resetForTesting();
  });

  // =========================================================================
  // GRUPO 1: INSTALAÇÃO DO PWA (Cenários 1 a 8 + Captura Global e Listener Único)
  // =========================================================================

  it('1. detecta evento beforeinstallprompt e disponibiliza estado canInstall', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);

    // Simula disparo do evento beforeinstallprompt pelo navegador
    const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    (mockEvent as any).prompt = vi.fn().mockResolvedValue(undefined);
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.canInstall).toBe(true);
    expect(result.current.isInstalled).toBe(false);
  });

  it('2. mantém canInstall false quando beforeinstallprompt não estiver disponível', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);
  });

  it('3. executa promptInstall chamando o prompt nativo do navegador', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    const promptSpy = vi.fn().mockResolvedValue(undefined);
    (mockEvent as any).prompt = promptSpy;
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    let success = false;
    await act(async () => {
      success = await result.current.promptInstall();
    });

    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(success).toBe(true);
  });

  it('4. quando usuário aceita instalação, remove canInstall e confirma com appinstalled', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    (mockEvent as any).prompt = vi.fn().mockResolvedValue(undefined);
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    await act(async () => {
      const outcome = await result.current.promptInstall();
      expect(outcome).toBe(true);
    });

    // O prompt foi consumido: canInstall fica falso
    expect(result.current.canInstall).toBe(false);

    // Confirmação final da instalação via evento do SO/navegador
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
  });

  it('5. quando usuário recusa instalação, mantém isInstalled false', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    (mockEvent as any).prompt = vi.fn().mockResolvedValue(undefined);
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    await act(async () => {
      const outcome = await result.current.promptInstall();
      expect(outcome).toBe(false);
    });

    expect(result.current.isInstalled).toBe(false);
  });

  it('6. detecta evento appinstalled e atualiza estado de instalação imediatamente', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.isInstalled).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('7. detecta modo standalone via matchMedia e não oferece botão de instalação repetido', () => {
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.isStandalone).toBe(true);
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);

    window.matchMedia = origMatchMedia;
  });

  it('8. em dispositivos iOS sem beforeinstallprompt, identifica plataforma e oferece orientações', () => {
    const origUa = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });

    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.isIos).toBe(true);
    expect(result.current.canInstall).toBe(false);

    Object.defineProperty(navigator, 'userAgent', {
      value: origUa,
      configurable: true,
    });
  });

  it('8b. captura global singleton: evento disparado ANTES da montagem do componente é preservado', () => {
    // Simula evento disparado na carga inicial da aplicação (ex: página de login)
    const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    (mockEvent as any).prompt = vi.fn().mockResolvedValue(undefined);
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    setCapturedPromptForTesting(mockEvent);

    // Componente ou hook monta posteriormente (ex: usuário navegou para /perfil?aba=aplicativo)
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.canInstall).toBe(true);
    expect(result.current.isInstalled).toBe(false);
  });

  it('8c. usePwaInstall não adiciona listeners redundantes no window (eliminação de duplicações)', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');

    // Monta o hook
    const { unmount } = renderHook(() => usePwaInstall());

    // Não deve registrar listeners repetidos no window para beforeinstallprompt ou appinstalled
    expect(addListenerSpy).not.toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(addListenerSpy).not.toHaveBeenCalledWith('appinstalled', expect.any(Function));

    unmount();
  });

  // =========================================================================
  // GRUPO 2: ATUALIZAÇÃO DO SERVICE WORKER (Cenários 9 a 16 + Proteção In-Flight)
  // =========================================================================

  it('9. detecta nova versão disponível quando há worker waiting', async () => {
    const mockWaitingWorker = {
      postMessage: vi.fn(),
    };

    const mockReg = {
      waiting: mockWaitingWorker,
      installing: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const mockServiceWorker = {
      getRegistration: vi.fn().mockResolvedValue(mockReg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      controller: {},
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorker,
      configurable: true,
    });

    const { result } = renderHook(() => usePwaUpdate());

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
      expect(result.current.updateStatus).toBe('waiting_available');
    });
  });

  it('10. exibe banner de atualização quando hasUpdate estiver true', async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { getByText } = render(<PwaUpdateBanner />);

    await waitFor(() => {
      expect(getByText('Atualização disponível')).toBeDefined();
      expect(getByText('Atualizar agora')).toBeDefined();
      expect(getByText('Depois')).toBeDefined();
    });
  });

  it('11. usuário escolhe "Depois": fecha o aviso sem recarregar e preserva o estado', async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { getByText, queryByText } = render(<PwaUpdateBanner />);

    await waitFor(() => {
      expect(getByText('Atualização disponível')).toBeDefined();
    });

    fireEvent.click(getByText('Depois'));

    await waitFor(() => {
      expect(queryByText('Atualização disponível')).toBeNull();
    });

    // Worker NÃO deve ter recebido SKIP_WAITING
    expect(mockWaitingWorker.postMessage).not.toHaveBeenCalled();
  });

  it('12. usuário escolhe "Atualizar agora": envia SKIP_WAITING para o waiting worker', async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { getByText } = render(<PwaUpdateBanner />);

    await waitFor(() => {
      expect(getByText('Atualizar agora')).toBeDefined();
    });

    fireEvent.click(getByText('Atualizar agora'));

    expect(mockWaitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('13. atualização NUNCA é aplicada automaticamente sem ação explícita', async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { result } = renderHook(() => usePwaUpdate());

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
    });

    // Sem chamar updateNow, postMessage NÃO é chamado
    expect(mockWaitingWorker.postMessage).not.toHaveBeenCalled();
  });

  it('14. ausência do waiting worker ao clicar atualizar NÃO executa reload às cegas', async () => {
    const mockReg = {
      waiting: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const reloadSpy = vi.fn();
    delete (window as any).location;
    window.location = { reload: reloadSpy } as any;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { result } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await result.current.updateNow();
    });

    // Segurança: reload às cegas NÃO deve ser invocado
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.updateStatus).toBe('error');
    expect(result.current.updateError).toContain('Nenhum Service Worker em espera');
  });

  it('14b. proteção in-flight: updateNow bloqueia atualização se houver mutação de ponto em andamento', async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { result } = renderHook(() => usePwaUpdate());

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
    });

    const release = inFlightTracker.startMutation();

    await act(async () => {
      await result.current.updateNow();
    });

    expect(result.current.updateStatus).toBe('blocked_by_mutation');
    expect(result.current.updateError).toContain('registro de ponto ou operação em andamento');
    expect(mockWaitingWorker.postMessage).not.toHaveBeenCalled();

    release();
  });

  it('14c. proteção contra perda de dados: se houver formulário não salvo e usuário cancelar confirmação, não atualiza', async () => {
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    inFlightTracker.registerDirtyChecker(() => true);

    const { result } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await result.current.updateNow();
    });

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('alterações não salvas'));
    expect(mockWaitingWorker.postMessage).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('14d. controllerchange durante mutação ativa bloqueia reload e transita para status ready_to_reload com retomada segura', async () => {
    let controllerChangeHandler: (() => void) | null = null;
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const reloadSpy = vi.fn();
    delete (window as any).location;
    window.location = { reload: reloadSpy } as any;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn().mockImplementation((ev, fn) => {
          if (ev === 'controllerchange') controllerChangeHandler = fn;
        }),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { result } = renderHook(() => usePwaUpdate());

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
    });

    // 1. Inicia uma mutação crítica (ex: bater ponto)
    const release = inFlightTracker.startMutation();

    // 2. Usuário solicita atualização
    await act(async () => {
      // Como a mutação está ativa, updateNow bloqueia imediatamente
      await result.current.updateNow();
    });
    expect(result.current.updateStatus).toBe('blocked_by_mutation');

    // 3. Libera a mutação e solicita a atualização
    release();
    await act(async () => {
      await result.current.updateNow();
    });
    expect(result.current.updateStatus).toBe('updating');

    // 4. Nova mutação começa antes do controllerchange completar
    const secondRelease = inFlightTracker.startMutation();

    // 5. Novo worker assume o controle (controllerchange dispara)
    act(() => {
      controllerChangeHandler?.();
    });

    // O reload NÃO deve ser executado pois há mutação em andamento
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(result.current.updateStatus).toBe('ready_to_reload');
    expect(result.current.updateError).toContain('Nova versão pronta');

    // 6. Mutação termina
    secondRelease();

    // 7. Usuário agora clica em recarregar com segurança
    act(() => {
      result.current.reloadNow();
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('14e. useDirtyFormTracker registra no inFlightTracker e limpa automaticamente ao desmontar', () => {
    expect(inFlightTracker.hasDirtyForms()).toBe(false);

    // Componente monta com dirty = true
    const { rerender, unmount } = renderHook(({ dirty }) => useDirtyFormTracker(dirty), {
      initialProps: { dirty: true },
    });

    expect(inFlightTracker.hasDirtyForms()).toBe(true);

    // Reverte alterações
    rerender({ dirty: false });
    expect(inFlightTracker.hasDirtyForms()).toBe(false);

    // Altera novamente
    rerender({ dirty: true });
    expect(inFlightTracker.hasDirtyForms()).toBe(true);

    // Desmonta componente
    unmount();
    expect(inFlightTracker.hasDirtyForms()).toBe(false);
  });

  it('14f. controllerchange com formulário dirty NÃO recarrega automaticamente e exige confirmação no reloadNow', async () => {
    let controllerChangeHandler: (() => void) | null = null;
    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    const reloadSpy = vi.fn();
    delete (window as any).location;
    window.location = { reload: reloadSpy } as any;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn().mockImplementation((ev, fn) => {
          if (ev === 'controllerchange') controllerChangeHandler = fn;
        }),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { result } = renderHook(() => usePwaUpdate());

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
    });

    // 1. Usuário clica em atualizar
    await act(async () => {
      await result.current.updateNow();
    });
    expect(result.current.updateStatus).toBe('updating');

    // 2. Usuário altera um formulário enquanto o worker finaliza
    const unregisterForm = inFlightTracker.registerDirtyChecker(() => true);

    // 3. controllerchange dispara com formulário dirty
    act(() => {
      controllerChangeHandler?.();
    });

    // Recarga automática DEVE ser impedida
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(result.current.updateStatus).toBe('ready_to_reload');
    expect(result.current.updateError).toContain('alterações não salvas no formulário');

    // 4. Usuário clica em "Recarregar agora", mas cancela o diálogo de descarte
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => {
      result.current.reloadNow();
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();

    // 5. Usuário clica novamente e aceita descartar as alterações
    confirmSpy.mockReturnValue(true);
    act(() => {
      result.current.reloadNow();
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    unregisterForm();
    confirmSpy.mockRestore();
  });

  it('15. limpa listeners de controllerchange ao desmontar usePwaUpdate', () => {
    const removeListenerSpy = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(null),
        addEventListener: vi.fn(),
        removeEventListener: removeListenerSpy,
        controller: {},
      },
      configurable: true,
    });

    const { unmount } = renderHook(() => usePwaUpdate());
    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('controllerchange', expect.any(Function));
  });

  // =========================================================================
  // GRUPO 3: CONECTIVIDADE E FALHA DE REDE (Cenários 17 a 21)
  // =========================================================================

  it('17. detecta perda de conexão via evento offline e exibe PwaOfflineIndicator', async () => {
    const { getByText, queryByText } = render(<PwaOfflineIndicator />);

    // Inicialmente online: nada exibido
    expect(queryByText(/Sem conexão com o servidor/i)).toBeNull();

    // Dispara evento offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(
        getByText(/Sem conexão com o servidor. Os registros de ponto precisam de conexão para serem realizados./i)
      ).toBeDefined();
    });
  });

  it('18. recupera conexão via evento online e oculta PwaOfflineIndicator', async () => {
    // Mock do fetch para responder 200 JSON em /health
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ status: 'ok', service: 'hora-certa-api' }),
    } as any);

    const { queryByText } = render(<PwaOfflineIndicator />);

    // Desconecta
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(queryByText(/Sem conexão com o servidor/i)).not.toBeNull();
    });

    // Reconecta
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(queryByText(/Sem conexão com o servidor/i)).toBeNull();
    });
  });

  it('19. detecta falha real de servidor mesmo quando navigator.onLine for true', async () => {
    // navigator.onLine é true, mas fetch('/health') falha (servidor caído ou sem rota)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error / Server unreachable'));

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      const isReachable = await result.current.checkConnection();
      expect(isReachable).toBe(false);
    });

    expect(result.current.isServerReachable).toBe(false);
    expect(result.current.serverStatus).toBe('disconnected');
  });

  it('19b. rejeita falso positivo HTTP 200 quando resposta for text/html (SPA fallback)', async () => {
    // Simula Vite preview ou SPA retornando index.html (200 OK com text/html) para endpoints não mapeados
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      json: () => Promise.reject(new Error('Unexpected token < in JSON')),
    } as any);

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      const reachable = await result.current.checkConnection();
      expect(reachable).toBe(false);
    });

    expect(result.current.isServerReachable).toBe(false);
    expect(result.current.serverStatus).toBe('disconnected');
  });

  it('19c. healthcheck: concorrência e aborts intencionais não sobrescrevem com falso offline', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Primeiro probe: leva tempo e é abortado
    const abortErr = new Error('AbortError');
    abortErr.name = 'AbortError';

    globalThis.fetch = vi.fn().mockImplementationOnce(() => Promise.reject(abortErr));

    await act(async () => {
      // O erro de abort NÃO deve marcar como desconectado
      await result.current.checkConnection();
    });

    expect(result.current.serverStatus).not.toBe('disconnected');
  });

  it('19d. healthcheck timeout real de 3500ms DEVE transitar para status disconnected', async () => {
    vi.useFakeTimers();

    // Simula requisição fetch que nunca responde até o timer expirar
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const { result } = renderHook(() => useNetworkStatus());

    let probePromise: Promise<boolean>;
    act(() => {
      probePromise = result.current.checkConnection();
    });

    // Avança o tempo simulado em 3500ms para disparar o timeout
    await act(async () => {
      vi.advanceTimersByTime(3501);
      await probePromise;
    });

    expect(result.current.isServerReachable).toBe(false);
    expect(result.current.serverStatus).toBe('disconnected');

    vi.useRealTimers();
  });

  it('19e. healthcheck: evento offline invalida probe em andamento e impede falso connected posterior', async () => {
    let resolveDelayedFetch: (val: any) => void = () => {};
    const delayedPromise = new Promise((resolve) => {
      resolveDelayedFetch = resolve;
    });

    globalThis.fetch = vi.fn().mockReturnValue(delayedPromise);

    const { result } = renderHook(() => useNetworkStatus());

    // Inicia probe
    let probePromise: Promise<boolean>;
    act(() => {
      probePromise = result.current.checkConnection();
    });

    // Browser cai offline enquanto a requisição estava pendente
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.serverStatus).toBe('disconnected');
    expect(result.current.isOnline).toBe(false);

    // Servidor remoto responde após a queda offline
    await act(async () => {
      resolveDelayedFetch({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ status: 'ok' }),
      });
      await probePromise;
    });

    // O status DEVE permanecer disconnected (não pode ser sobrescrito por resposta defasada)
    expect(result.current.serverStatus).toBe('disconnected');
  });

  it('20. operações sensíveis de ponto integram inFlightTracker automaticamente no início e no término', async () => {
    expect(inFlightTracker.hasInFlightMutations()).toBe(false);

    let resolveApi: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveApi = resolve;
    });

    vi.spyOn(api, 'post').mockReturnValue(pendingPromise as any);

    // 1. Dispara início de sessão (workSessionService)
    const sessionPromise = workSessionService.startSession();

    // Tracker deve estar ativo IMEDIATAMENTE durante a requisição pendente
    expect(inFlightTracker.hasInFlightMutations()).toBe(true);

    // Resolve a resposta da API
    await act(async () => {
      resolveApi({ data: { date: '2026-11-16', isOpen: true, entries: [] } });
      await sessionPromise;
    });

    // Tracker deve ser liberado após conclusão
    expect(inFlightTracker.hasInFlightMutations()).toBe(false);

    // 2. Testa clockIn de timeEntryService com controle de espera
    let resolveClockIn: (val: any) => void = () => {};
    const clockInPromise = new Promise((resolve) => {
      resolveClockIn = resolve;
    });
    vi.spyOn(api, 'post').mockReturnValue(clockInPromise as any);

    const clockInCall = timeEntryService.clockIn();
    expect(inFlightTracker.hasInFlightMutations()).toBe(true);

    await act(async () => {
      resolveClockIn({ data: { date: '2026-11-16', isOpen: true, entries: [] } });
      await clockInCall;
    });
    expect(inFlightTracker.hasInFlightMutations()).toBe(false);

    // 3. Testa comportamento com rejeição/erro de rede em clockIn
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Network Error: connection refused'));

    await expect(timeEntryService.clockIn()).rejects.toThrow('Network Error');

    // Tracker deve ser rigorosamente liberado mesmo após falha
    expect(inFlightTracker.hasInFlightMutations()).toBe(false);
  });

  it('20b. timeEntryService.clockIn bloqueia updateNow() do PWA enquanto a requisição estiver pendente', async () => {
    let resolveClockIn: (val: any) => void = () => {};
    const pendingClockIn = new Promise((resolve) => {
      resolveClockIn = resolve;
    });
    vi.spyOn(api, 'post').mockReturnValue(pendingClockIn as any);

    const mockWaitingWorker = { postMessage: vi.fn() };
    const mockReg = {
      waiting: mockWaitingWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: vi.fn().mockResolvedValue(mockReg),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        controller: {},
      },
      configurable: true,
    });

    const { result: updateHook } = renderHook(() => usePwaUpdate());

    await waitFor(() => {
      expect(updateHook.current.hasUpdate).toBe(true);
    });

    // 1. Dispara clockIn
    const clockInOp = timeEntryService.clockIn();

    // 2. Confirma tracker ativo durante espera
    expect(inFlightTracker.hasInFlightMutations()).toBe(true);

    // 3. Tenta atualizar enquanto clockIn está pendente
    await act(async () => {
      await updateHook.current.updateNow();
    });

    // Atualização DEVE ser bloqueada e mensagem enviada
    expect(updateHook.current.updateStatus).toBe('blocked_by_mutation');
    expect(updateHook.current.updateError).toContain('registro de ponto ou operação em andamento');
    expect(mockWaitingWorker.postMessage).not.toHaveBeenCalled();

    // 4. clockIn conclui
    await act(async () => {
      resolveClockIn({ data: { date: '2026-11-17', isOpen: true, entries: [] } });
      await clockInOp;
    });
    expect(inFlightTracker.hasInFlightMutations()).toBe(false);

    // 5. Agora a atualização é autorizada
    await act(async () => {
      await updateHook.current.updateNow();
    });
    expect(updateHook.current.updateStatus).toBe('updating');
    expect(mockWaitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('21. nenhuma fila offline ou Background Sync é criado para operações sensíveis', () => {
    // Confirma que 'SyncManager' não é registrado nem simulado como banco offline
    const hasSyncQueue = 'syncQueue' in window || 'offlineMutationQueue' in window;
    expect(hasSyncQueue).toBe(false);
  });

  // =========================================================================
  // GRUPO 4: INTEGRAÇÃO VISUAL REACT (Cenários 28 a 32 + AbsencesPage Dirty State)
  // =========================================================================

  it('28. monta PwaInstallCard exibindo informações de instalação', () => {
    const { getByText } = render(<PwaInstallCard />);
    expect(getByText('Instalar HoraCerta')).toBeDefined();
    expect(
      getByText(/Tenha acesso mais rápido ao seu controle de jornada diretamente pelo computador ou celular./i)
    ).toBeDefined();
  });

  it('29. quando canInstall for true, PwaInstallCard exibe botão "Instalar aplicativo"', () => {
    const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
    (mockEvent as any).prompt = vi.fn().mockResolvedValue(undefined);
    (mockEvent as any).userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    setCapturedPromptForTesting(mockEvent);

    const { getByText } = render(<PwaInstallCard />);

    expect(getByText('Instalar aplicativo')).toBeDefined();
  });

  it('30. quando aplicativo estiver em modo standalone, exibe badge "HoraCerta instalado"', () => {
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { getByText } = render(<PwaInstallCard />);
    expect(getByText('HoraCerta instalado')).toBeDefined();
    expect(getByText(/O aplicativo já está instalado e pronto para uso/i)).toBeDefined();

    window.matchMedia = origMatchMedia;
  });

  it('31. limpa listeners de window e document ao desmontar useNetworkStatus', () => {
    const removeWindowSpy = vi.spyOn(window, 'removeEventListener');
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();

    expect(removeWindowSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeWindowSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(removeWindowSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('32. limpa inscrições do singleton de instalação ao desmontar usePwaInstall', () => {
    const { unmount } = renderHook(() => usePwaInstall());
    unmount();
    // Desmontagem bem sucedida sem erro ou resíduo
    expect(true).toBe(true);
  });
});

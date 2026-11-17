import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkStatusState, ServerReachabilityStatus } from '../types';
import { env } from '../../../config/env';
import { api } from '../../../services/api';

/**
 * Retorna dinamicamente a URL do healthcheck do backend (ex: http://localhost:3333/health).
 * Acompanha a configuração real da API (api.defaults.baseURL ou env.VITE_API_URL),
 * removendo qualquer sufixo /api para atingir o endpoint /health na raiz do servidor.
 */
export function getHealthUrl(): string {
  const configuredBase = api.defaults.baseURL || env.VITE_API_URL || 'http://localhost:3333';
  const baseUrl = configuredBase.replace(/\/api\/?$/, '');
  return `${baseUrl}/health`;
}

export function useNetworkStatus(): NetworkStatusState & { checkConnection: () => Promise<boolean> } {
  const isOnlineInitial = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const [isOnline, setIsOnline] = useState<boolean>(isOnlineInitial);
  const [serverStatus, setServerStatus] = useState<ServerReachabilityStatus>(() =>
    !isOnlineInitial ? 'disconnected' : 'checking'
  );
  const [isServerReachable, setIsServerReachable] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const probeSeqRef = useRef<number>(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    const currentSeq = ++probeSeqRef.current;

    // 1. Se o navegador reporta offline de forma explícita
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (isMountedRef.current && currentSeq === probeSeqRef.current) {
        setIsOnline(false);
        setIsServerReachable(false);
        setServerStatus('disconnected');
      }
      return false;
    }

    // Cancela requisição anterior para evitar concorrência desordenada
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;

    let isTimedOut = false;
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      controller.abort();
    }, 3500);

    try {
      const healthUrl = getHealthUrl();
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      // Se durante a espera a requisição foi sobreposta ou o browser ficou offline, ignora
      if (currentSeq !== probeSeqRef.current || !isMountedRef.current) {
        return false;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        setIsServerReachable(false);
        setServerStatus('disconnected');
        return false;
      }

      // Validação estrita:
      // - Deve ser HTTP 200 (response.ok)
      // - Content-Type DEVE conter application/json (rejeita text/html de fallback SPA)
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
        if (isMountedRef.current && currentSeq === probeSeqRef.current) {
          setIsServerReachable(false);
          setServerStatus('disconnected');
        }
        return false;
      }

      const data = await response.json().catch(() => null);
      const isHealthy = Boolean(data && data.status === 'ok');

      if (isMountedRef.current && currentSeq === probeSeqRef.current) {
        setIsServerReachable(isHealthy);
        setServerStatus(isHealthy ? 'connected' : 'disconnected');
      }
      return isHealthy;
    } catch (err: any) {
      // Regra 1: Requisições obsoletas (substituídas por uma mais nova) NÃO alteram o estado
      if (currentSeq !== probeSeqRef.current) {
        return false;
      }

      // Regra 2: Componente desmontado NÃO altera o estado
      if (!isMountedRef.current) {
        return false;
      }

      // Regra 3: Se o navegador estiver offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        setIsServerReachable(false);
        setServerStatus('disconnected');
        return false;
      }

      // Regra 4: Timeout efetivo da requisição atual DEVE produzir 'disconnected'
      if (isTimedOut) {
        setIsServerReachable(false);
        setServerStatus('disconnected');
        return false;
      }

      // Regra 5: Erro real de transporte / conexão recusada (não é Abort) DEVE produzir 'disconnected'
      if (err?.name !== 'AbortError') {
        setIsServerReachable(false);
        setServerStatus('disconnected');
        return false;
      }

      // Outros aborts não relacionados a timeout nem a erro real são ignorados
      return false;
    } finally {
      clearTimeout(timeoutId);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const handleOnline = () => {
      if (isMountedRef.current) {
        setIsOnline(true);
        checkConnection();
      }
    };

    const handleOffline = () => {
      // Invalida imediatamente qualquer requisição em andamento na rede
      probeSeqRef.current++;
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }

      if (isMountedRef.current) {
        setIsOnline(false);
        setIsServerReachable(false);
        setServerStatus('disconnected');
      }
    };

    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkConnection();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    // Initial check se o navegador reportar online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      checkConnection();
    }

    // Intervalo moderado a cada 60 segundos
    const intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        checkConnection();
      }
    }, 60000);

    return () => {
      isMountedRef.current = false;
      probeSeqRef.current++;
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [checkConnection]);

  return {
    isOnline,
    isServerReachable,
    serverStatus,
    checkConnection,
  };
}

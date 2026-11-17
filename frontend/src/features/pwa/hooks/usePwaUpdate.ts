import { useState, useEffect, useCallback, useRef } from 'react';
import { PwaUpdateState, UpdateCycleStatus } from '../types';
import { inFlightTracker } from '../utils/inFlightTracker';

export function usePwaUpdate(): PwaUpdateState {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateCycleStatus>('idle');
  const [updateError, setUpdateError] = useState<string | null>(null);

  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const userRequestedUpdateRef = useRef<boolean>(false);
  const hasReloadedRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleWaitingWorker = (sw: ServiceWorker | null) => {
      if (sw && isMountedRef.current) {
        waitingWorkerRef.current = sw;
        setHasUpdate(true);
        setUpdateStatus((prev) => (prev === 'idle' ? 'waiting_available' : prev));
      }
    };

    let installingWorkerRef: ServiceWorker | null = null;
    let registrationRef: ServiceWorkerRegistration | null = null;

    const handleStateChange = () => {
      if (
        installingWorkerRef &&
        installingWorkerRef.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        handleWaitingWorker(installingWorkerRef);
      }
    };

    const handleUpdateFound = () => {
      if (!registrationRef) return;
      const worker = registrationRef.installing;
      if (!worker) return;

      installingWorkerRef = worker;
      worker.addEventListener('statechange', handleStateChange);
    };

    // 1. Obtenção do registro do Service Worker
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg || !isMountedRef.current) return;
        registrationRef = reg;

        // Se já houver um worker aguardando ativação
        if (reg.waiting) {
          handleWaitingWorker(reg.waiting);
        }

        // Se uma nova versão for detectada em download
        reg.addEventListener('updatefound', handleUpdateFound);
      })
      .catch((err) => {
        if (isMountedRef.current) {
          console.warn('[PWA] Falha ao verificar registro do Service Worker:', err);
        }
      });

    // 2. Listener central de controllerchange (novo SW assumiu o controle)
    const handleControllerChange = () => {
      // Se a atualização não foi solicitada pelo usuário, não executa recarga inesperada
      if (!userRequestedUpdateRef.current) {
        return;
      }

      // Proteção crítica A: se houver mutação em andamento, BLOQUEIA o reload
      if (inFlightTracker.hasInFlightMutations()) {
        if (isMountedRef.current) {
          setUpdateStatus('ready_to_reload');
          setUpdateError(
            'Nova versão pronta! Há uma operação de ponto em andamento. Clique em "Recarregar agora" assim que concluir.'
          );
        }
        return;
      }

      // Proteção crítica B: se houver formulário não salvo, BLOQUEIA reload automático
      if (inFlightTracker.hasDirtyForms()) {
        if (isMountedRef.current) {
          setUpdateStatus('ready_to_reload');
          setUpdateError(
            'Nova versão pronta! Existem alterações não salvas no formulário. Salve os dados ou clique em "Recarregar agora" para confirmar o descarte.'
          );
        }
        return;
      }

      // Sem mutações e sem formulários alterados: recarga segura
      if (!hasReloadedRef.current) {
        hasReloadedRef.current = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      isMountedRef.current = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);

      if (registrationRef) {
        registrationRef.removeEventListener('updatefound', handleUpdateFound);
      }
      if (installingWorkerRef) {
        installingWorkerRef.removeEventListener('statechange', handleStateChange);
      }
    };
  }, []);

  const updateNow = useCallback(async (): Promise<void> => {
    // 1. Bloqueio absoluto durante mutações ativas (ponto, pausas, reconciliação)
    if (inFlightTracker.hasInFlightMutations()) {
      setUpdateStatus('blocked_by_mutation');
      setUpdateError(
        'Não é possível atualizar no momento pois há um registro de ponto ou operação em andamento. Conclua a operação antes de atualizar.'
      );
      return;
    }

    // 2. Proteção contra perda de dados em formulários alterados
    if (inFlightTracker.hasDirtyForms()) {
      const confirmed = window.confirm(
        'Existem alterações não salvas no formulário. Deseja realmente atualizar a aplicação agora?'
      );
      if (!confirmed) {
        return;
      }
    }

    // 3. Verificação do worker em waiting
    const worker = waitingWorkerRef.current;
    if (!worker) {
      setUpdateStatus('error');
      setUpdateError('Nenhum Service Worker em espera encontrado para atualização.');
      return;
    }

    // 4. Dispara a transição de atualização
    try {
      userRequestedUpdateRef.current = true;
      setUpdateStatus('updating');
      setUpdateError(null);
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (err: any) {
      userRequestedUpdateRef.current = false;
      setUpdateStatus('error');
      setUpdateError(`Erro ao comunicar com o Service Worker: ${err?.message || 'falha desconhecida'}`);
    }
  }, []);

  const reloadNow = useCallback((): void => {
    // 1. Mutação em andamento nunca pode ser recarregada
    if (inFlightTracker.hasInFlightMutations()) {
      alert('Não é possível recarregar no momento pois há um registro de ponto ou operação em andamento. Aguarde a conclusão da operação.');
      return;
    }

    // 2. Se houver formulário não salvo, exige confirmação explícita de descarte
    if (inFlightTracker.hasDirtyForms()) {
      const confirmed = window.confirm(
        'Existem alterações não salvas no formulário. Deseja realmente descartar as alterações e recarregar a aplicação agora?'
      );
      if (!confirmed) {
        return;
      }
    }

    // 3. Recarga segura com proteção contra execução duplicada
    if (!hasReloadedRef.current) {
      hasReloadedRef.current = true;
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setHasUpdate(false);
    setUpdateStatus('idle');
    setUpdateError(null);
  }, []);

  const isUpdating = updateStatus === 'updating';

  return {
    hasUpdate,
    isUpdating,
    updateStatus,
    updateError,
    updateNow,
    reloadNow,
    dismissUpdate,
  };
}

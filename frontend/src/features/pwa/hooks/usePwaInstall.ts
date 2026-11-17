import { useState, useEffect, useCallback } from 'react';
import { BeforeInstallPromptEvent, PwaInstallState } from '../types';

/**
 * Singleton State & Event Listeners para PWA Installation
 * Centraliza a captura de 'beforeinstallprompt' e 'appinstalled' no nível global
 * desde a inicialização da aplicação, evitando listeners duplicados por instância.
 */
let capturedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let isGloballyInstalled = false;
const installSubscribers = new Set<() => void>();

function notifySubscribers() {
  installSubscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      // Evita interrupção por erros em subscribers individuais
    }
  });
}

function checkStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any)?.standalone === true ||
    (typeof document !== 'undefined' && document.referrer.includes('android-app://'))
  );
}

// Inicializa os listeners globais uma única vez no ambiente do navegador
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Previne infobar nativa intrusiva do navegador e retém o evento
    e.preventDefault();
    capturedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    capturedDeferredPrompt = null;
    isGloballyInstalled = true;
    notifySubscribers();
  });
}

/**
 * Reseta o estado global para testes unitários isolados
 */
export function resetPwaInstallStateForTesting(): void {
  capturedDeferredPrompt = null;
  isGloballyInstalled = false;
  installSubscribers.clear();
}

/**
 * Define o evento capturado para testes unitários
 */
export function setCapturedPromptForTesting(event: BeforeInstallPromptEvent | null): void {
  capturedDeferredPrompt = event;
  notifySubscribers();
}

/**
 * Retorna se existe evento de instalação capturado (para inspeção e testes)
 */
export function getCapturedPromptForTesting(): BeforeInstallPromptEvent | null {
  return capturedDeferredPrompt;
}

export function usePwaInstall(): PwaInstallState {
  const [standalone, setStandalone] = useState<boolean>(() => checkStandaloneMode());
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => Boolean(capturedDeferredPrompt));
  const [installed, setInstalled] = useState<boolean>(() => isGloballyInstalled || checkStandaloneMode());
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Callback de sincronização de estado com o singleton
  const updateState = useCallback(() => {
    const isStand = checkStandaloneMode();
    setStandalone(isStand);
    setHasPrompt(Boolean(capturedDeferredPrompt));
    setInstalled(isGloballyInstalled || isStand);
  }, []);

  useEffect(() => {
    // 1. Detecção de plataforma / user agent
    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
      setIsIos(isApple);
      setIsMobile(/android|iphone|ipad|ipod|mobile/.test(ua));
    }

    // 2. Sincroniza estado imediatamente na montagem
    updateState();

    // 3. Inscreve-se exclusivamente no singleton central (sem registrar listeners duplicados no window)
    installSubscribers.add(updateState);

    return () => {
      // 4. Limpeza rigorosa da inscrição ao desmontar
      installSubscribers.delete(updateState);
    };
  }, [updateState]);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    const prompt = capturedDeferredPrompt;
    if (!prompt) {
      return false;
    }

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;

      // O prompt só pode ser disparado uma única vez pelo navegador; limpa após uso
      capturedDeferredPrompt = null;
      setHasPrompt(false);
      notifySubscribers();

      // Observação de segurança e fidelidade:
      // outcome === 'accepted' significa que o usuário confirmou o diálogo nativo.
      // A confirmação definitiva de instalação no SO é confirmada pelo evento 'appinstalled'.
      return choice.outcome === 'accepted';
    } catch (_error) {
      capturedDeferredPrompt = null;
      setHasPrompt(false);
      notifySubscribers();
      return false;
    }
  }, []);

  const isStandalone = standalone;
  const isInstalled = installed || isStandalone;
  const canInstall = Boolean(hasPrompt && !isStandalone && !isInstalled);

  return {
    canInstall,
    isInstalled,
    isStandalone,
    isIos,
    isMobile,
    promptInstall,
  };
}

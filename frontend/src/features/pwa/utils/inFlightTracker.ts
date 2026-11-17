/**
 * HoraCerta PWA — In-Flight Mutation & Dirty Form Tracker
 * 
 * Protege a aplicação contra recarregamentos acidentais durante
 * registro de ponto, operações de jornada e edições não salvas de formulários.
 */

let inFlightCount = 0;
const dirtyCheckers = new Set<() => boolean>();

export const inFlightTracker = {
  /**
   * Inicia o rastreamento de uma mutação ativa e retorna uma função de liberação segura.
   * Garante que o contador nunca fique negativo.
   */
  startMutation(): () => void {
    inFlightCount++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        inFlightCount = Math.max(0, inFlightCount - 1);
      }
    };
  },

  /**
   * Envolve uma Promise ou função assíncrona de mutação (ex: registrar ponto).
   * O rastreamento inicia IMEDIATAMENTE antes da execução da requisição
   * e é liberado no bloco finally, garantindo liberação em sucesso, erro ou cancelamento.
   */
  async track<T>(promiseOrFn: Promise<T> | (() => Promise<T>)): Promise<T> {
    const release = inFlightTracker.startMutation();
    try {
      const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
      return await promise;
    } finally {
      release();
    }
  },

  /**
   * Retorna true se houver mutações de ponto, jornada ou dados em andamento.
   */
  hasInFlightMutations(): boolean {
    return inFlightCount > 0;
  },

  /**
   * Retorna o total de mutações em andamento no momento (útil para auditoria e testes).
   */
  getInFlightCount(): number {
    return inFlightCount;
  },

  /**
   * Registra uma função verificadora de estado sujo (formulários não salvos).
   * Retorna uma função para desregistrar o verificador ao desmontar.
   */
  registerDirtyChecker(checker: () => boolean): () => void {
    dirtyCheckers.add(checker);
    return () => {
      dirtyCheckers.delete(checker);
    };
  },

  /**
   * Retorna true se houver qualquer formulário com alterações pendentes.
   */
  hasDirtyForms(): boolean {
    for (const checker of dirtyCheckers) {
      try {
        if (checker()) return true;
      } catch {
        // Evita que erro em verificador individual trave o sistema
      }
    }
    return false;
  },

  /**
   * Reseta o estado global para testes unitários isolados.
   */
  _resetForTesting(): void {
    inFlightCount = 0;
    dirtyCheckers.clear();
  },
};

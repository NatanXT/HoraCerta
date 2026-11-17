import { useEffect, useRef } from 'react';
import { inFlightTracker } from '../utils/inFlightTracker';

/**
 * Hook que registra o estado "dirty" (alterações não salvas) de um formulário
 * no inFlightTracker do PWA.
 * 
 * - Não armazena senhas, dados de formulário ou informações pessoais no tracker.
 * - Registra apenas uma função verificadora booleana.
 * - Desregistra automaticamente ao desmontar o componente.
 * - Suporta reversão de campos aos valores originais limpando o estado.
 */
export function useDirtyFormTracker(isDirty: boolean): void {
  const isDirtyRef = useRef<boolean>(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    // Registra um verificador que consulta o valor mais recente da ref
    const unregister = inFlightTracker.registerDirtyChecker(() => isDirtyRef.current);
    return unregister;
  }, []);
}

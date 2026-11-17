import React from 'react';
import { RefreshCw, X, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePwaUpdate } from '../hooks/usePwaUpdate';

export const PwaUpdateBanner: React.FC = () => {
  const {
    hasUpdate,
    isUpdating,
    updateStatus,
    updateError,
    updateNow,
    reloadNow,
    dismissUpdate,
  } = usePwaUpdate();

  if (!hasUpdate && updateStatus !== 'ready_to_reload' && updateStatus !== 'blocked_by_mutation') {
    return null;
  }

  const isReadyToReload = updateStatus === 'ready_to_reload';
  const isBlocked = updateStatus === 'blocked_by_mutation';

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Atualização disponível"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-4 shadow-xl backdrop-blur-md animate-fade-in print:hidden"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] flex items-center justify-center text-[var(--hc-accent)] shrink-0 mt-0.5">
          {isReadyToReload ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : isBlocked ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--hc-text)]">
            {isReadyToReload
              ? 'Atualização pronta!'
              : isBlocked
              ? 'Operação em andamento'
              : 'Atualização disponível'}
          </h3>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5">
            {updateError ||
              (isReadyToReload
                ? 'A nova versão já está pronta. Recarregue para aplicar as melhorias.'
                : 'Uma nova versão do HoraCerta está disponível. Deseja atualizar agora?')}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {isReadyToReload ? (
              <button
                type="button"
                onClick={reloadNow}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recarregar agora
              </button>
            ) : (
              <button
                type="button"
                onClick={updateNow}
                disabled={isUpdating}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Atualizando...' : isBlocked ? 'Tentar novamente' : 'Atualizar agora'}
              </button>
            )}

            <button
              type="button"
              onClick={dismissUpdate}
              disabled={isUpdating}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] transition-all cursor-pointer"
            >
              Depois
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissUpdate}
          aria-label="Fechar aviso de atualização"
          className="text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] p-1 rounded-lg hover:bg-[var(--hc-surface-raised)] transition-all cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

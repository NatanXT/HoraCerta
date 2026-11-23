import React from 'react';
import { SearchX, Calendar } from 'lucide-react';

interface AnalyticsEmptyStateProps {
  onResetPreset?: () => void;
}

export const AnalyticsEmptyState: React.FC<AnalyticsEmptyStateProps> = ({ onResetPreset }) => {
  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-xs">
      <div className="w-12 h-12 rounded-2xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-[var(--hc-text-muted)] mx-auto flex items-center justify-center">
        <SearchX className="w-6 h-6" aria-hidden="true" />
      </div>

      <div className="max-w-md mx-auto space-y-1.5">
        <h3 className="text-base font-bold text-[var(--hc-text)] tracking-tight">
          Nenhum dado encontrado para o período
        </h3>
        <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
          Não há registros de ponto, ocorrências ou saldos apurados no intervalo de datas selecionado.
        </p>
      </div>

      {onResetPreset && (
        <button
          type="button"
          onClick={onResetPreset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-xs font-semibold text-[var(--hc-accent-foreground)] shadow-xs transition-all cursor-pointer"
        >
          <Calendar className="w-4 h-4" aria-hidden="true" />
          <span>Voltar ao mês atual</span>
        </button>
      )}
    </div>
  );
};

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel } from '../../utils/date';

interface MonthSelectorProps {
  selectedMonth: string;
  isCurrentMonthSelected: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export function MonthSelector({
  selectedMonth,
  isCurrentMonthSelected,
  onPreviousMonth,
  onNextMonth,
}: MonthSelectorProps) {
  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <div className="flex items-center justify-between bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-4 shadow-md backdrop-blur-sm">
      <button
        type="button"
        onClick={onPreviousMonth}
        aria-label="Mês anterior"
        className="w-10 h-10 rounded-xl bg-[var(--hc-surface-raised)] hover:bg-[var(--hc-border)] active:opacity-90 text-[var(--hc-text)] border border-[var(--hc-border)] flex items-center justify-center transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>

      <div className="text-center">
        <h2 className="text-base sm:text-lg font-bold text-[var(--hc-text)] tracking-tight">
          {monthLabel}
        </h2>
        <p className="text-[11px] text-[var(--hc-text-secondary)]">Navegação mensal da jornada</p>
      </div>

      <button
        type="button"
        onClick={onNextMonth}
        disabled={isCurrentMonthSelected}
        aria-label="Próximo mês"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
          isCurrentMonthSelected
            ? 'bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] border border-[var(--hc-border)] cursor-not-allowed opacity-40'
            : 'bg-[var(--hc-surface-raised)] hover:bg-[var(--hc-border)] active:opacity-90 text-[var(--hc-text)] border border-[var(--hc-border)] cursor-pointer'
        }`}
      >
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

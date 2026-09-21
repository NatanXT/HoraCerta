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
    <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-md backdrop-blur-sm">
      <button
        type="button"
        onClick={onPreviousMonth}
        aria-label="Mês anterior"
        className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-800 text-slate-200 border border-slate-700/50 flex items-center justify-center transition-colors cursor-pointer"
      >
        ◀
      </button>

      <div className="text-center">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
          {monthLabel}
        </h2>
        <p className="text-[11px] text-slate-400">Navegação mensal da jornada</p>
      </div>

      <button
        type="button"
        onClick={onNextMonth}
        disabled={isCurrentMonthSelected}
        aria-label="Próximo mês"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
          isCurrentMonthSelected
            ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50'
            : 'bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-800 text-slate-200 border border-slate-700/50 cursor-pointer'
        }`}
      >
        ▶
      </button>
    </div>
  );
}

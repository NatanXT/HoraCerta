import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Clock } from 'lucide-react';
import { formatMonthLabel } from '../../utils/date';
import { CalendarViewMode } from './types';

export interface SmartCalendarMonthSelectorProps {
  selectedMonth: string;
  isCurrentMonthSelected: boolean;
  viewMode: CalendarViewMode;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

export const SmartCalendarMonthSelector: React.FC<SmartCalendarMonthSelectorProps> = ({
  selectedMonth,
  isCurrentMonthSelected,
  viewMode,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onViewModeChange,
}) => {
  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-3.5 sm:p-4 shadow-sm backdrop-blur-sm">
      {/* Navigation Controls Group */}
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onPreviousMonth}
          aria-label="Mês anterior"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--hc-surface-raised)] hover:bg-[var(--hc-border)] active:opacity-90 text-[var(--hc-text)] border border-[var(--hc-border)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="text-center sm:text-left min-w-[140px] sm:min-w-[180px]">
          <h2 className="text-base sm:text-lg font-bold text-[var(--hc-text)] tracking-tight">
            {monthLabel}
          </h2>
          <p className="text-[11px] text-[var(--hc-text-secondary)]">Calendário inteligente de jornada</p>
        </div>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Próximo mês"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--hc-surface-raised)] hover:bg-[var(--hc-border)] active:opacity-90 text-[var(--hc-text)] border border-[var(--hc-border)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Action Controls: "Hoje" button + View Switcher */}
      <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--hc-border)]">
        {/* Botão Hoje */}
        <button
          type="button"
          onClick={onToday}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
            isCurrentMonthSelected
              ? 'bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] border-[var(--hc-border)]'
              : 'bg-[var(--hc-surface-raised)] text-[var(--hc-text)] border-[var(--hc-border)] hover:bg-[var(--hc-surface)]'
          }`}
          title="Ir para o mês e dia atual"
        >
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Hoje</span>
        </button>

        {/* View Mode Switcher: Calendário / Lista */}
        <div
          role="radiogroup"
          aria-label="Modo de visualização"
          className="flex items-center p-0.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'calendar'}
            onClick={() => onViewModeChange('calendar')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-[var(--hc-surface)] text-[var(--hc-text)] shadow-xs border border-[var(--hc-border)] font-bold'
                : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[var(--hc-accent)]" aria-hidden="true" />
            <span>Calendário</span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'list'}
            onClick={() => onViewModeChange('list')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[var(--hc-surface)] text-[var(--hc-text)] shadow-xs border border-[var(--hc-border)] font-bold'
                : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)]'
            }`}
          >
            <List className="w-3.5 h-3.5 text-[var(--hc-accent)]" aria-hidden="true" />
            <span>Lista</span>
          </button>
        </div>
      </div>
    </div>
  );
};

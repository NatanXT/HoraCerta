import React from 'react';
import { Calendar, Filter, ArrowRight, AlertCircle } from 'lucide-react';
import { AnalyticsPeriodPreset, AnalyticsDateRange } from '../types';
import { formatFullDate } from '../../../utils/date';

interface AnalyticsPeriodFilterProps {
  preset: AnalyticsPeriodPreset;
  range: AnalyticsDateRange;
  customStartDate: string;
  customEndDate: string;
  customError: string | null;
  loading: boolean;
  onSelectPreset: (preset: AnalyticsPeriodPreset) => void;
  onChangeCustomStart: (val: string) => void;
  onChangeCustomEnd: (val: string) => void;
  onApplyCustom: () => void;
}

export const AnalyticsPeriodFilter: React.FC<AnalyticsPeriodFilterProps> = ({
  preset,
  range,
  customStartDate,
  customEndDate,
  customError,
  loading,
  onSelectPreset,
  onChangeCustomStart,
  onChangeCustomEnd,
  onApplyCustom,
}) => {
  const PRESET_OPTIONS: { id: AnalyticsPeriodPreset; label: string }[] = [
    { id: 'current-month', label: 'Mês atual' },
    { id: 'last-3-months', label: 'Últimos 3 meses' },
    { id: 'last-6-months', label: 'Últimos 6 meses' },
    { id: 'custom', label: 'Personalizado' },
  ];

  return (
    <section
      aria-label="Filtro de período analítico"
      className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--hc-text-secondary)]">
          <Filter className="w-4 h-4 text-[var(--hc-accent)]" aria-hidden="true" />
          <span>Período de Análise</span>
        </div>

        {/* Formatted active range badge */}
        <div className="text-xs text-[var(--hc-text-muted)] flex items-center gap-1.5 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-[var(--hc-accent)] shrink-0" aria-hidden="true" />
          <span>
            {formatFullDate(range.startDate)}
          </span>
          <ArrowRight className="w-3 h-3 text-[var(--hc-text-muted)] shrink-0" aria-hidden="true" />
          <span>
            {formatFullDate(range.endDate)}
          </span>
        </div>
      </div>

      {/* Preset Pill Buttons */}
      <div
        role="group"
        aria-label="Opções de período predefinido"
        className="flex flex-wrap items-center gap-1.5 bg-[var(--hc-surface-raised)] p-1 rounded-xl border border-[var(--hc-border)]"
      >
        {PRESET_OPTIONS.map((opt) => {
          const isActive = preset === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectPreset(opt.id)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer disabled:opacity-50 ${
                isActive
                  ? 'bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] shadow-xs'
                  : 'text-[var(--hc-text-secondary)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface)]'
              }`}
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Custom Range Inputs (Shown when 'custom' is active or user wants to customize) */}
      {preset === 'custom' && (
        <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-3 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <label
                htmlFor="analytics-custom-start"
                className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block"
              >
                Data inicial
              </label>
              <input
                id="analytics-custom-start"
                type="date"
                value={customStartDate}
                onChange={(e) => onChangeCustomStart(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--hc-border)] bg-[var(--hc-surface)] text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
              />
            </div>

            <div className="flex-1 space-y-1">
              <label
                htmlFor="analytics-custom-end"
                className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block"
              >
                Data final
              </label>
              <input
                id="analytics-custom-end"
                type="date"
                value={customEndDate}
                onChange={(e) => onChangeCustomEnd(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--hc-border)] bg-[var(--hc-surface)] text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)]"
              />
            </div>

            <button
              type="button"
              onClick={onApplyCustom}
              disabled={loading}
              className="px-4 py-2 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-[var(--hc-accent-foreground)] text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 h-[34px] self-end"
            >
              Aplicar intervalo
            </button>
          </div>

          {customError && (
            <div
              role="alert"
              className="flex items-center gap-1.5 text-xs text-rose-500 font-medium"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{customError}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

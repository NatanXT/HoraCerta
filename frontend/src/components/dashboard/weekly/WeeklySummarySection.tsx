import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from 'lucide-react';
import { useWeeklySummary } from '../../../hooks/useWeeklySummary';
import { getWeekDateRange, formatWeekRangeLabel } from '../../../utils/date';
import { WeeklyMetricCards } from './WeeklyMetricCards';
import { WeeklyInsightCard } from './WeeklyInsightCard';
import { WeeklyChart } from './WeeklyChart';

interface WeeklySummarySectionProps {
  refreshTrigger?: unknown;
}

export const WeeklySummarySection: React.FC<WeeklySummarySectionProps> = ({ refreshTrigger }) => {
  const {
    selectedMondayStr,
    data,
    loading,
    isStale,
    error,
    isCurrentWeekSelected,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    retry,
  } = useWeeklySummary({ refreshTrigger });

  const weekRange = getWeekDateRange(selectedMondayStr);
  const weekRangeLabel = formatWeekRangeLabel(weekRange.mondayStr, weekRange.sundayStr);

  return (
    <section aria-label="Resumo da semana" className="space-y-4 pt-2">
      {/* Section Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--hc-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[var(--hc-text)] tracking-tight">
              Resumo da Semana
            </h3>
            {isCurrentWeekSelected && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Esta semana
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5 capitalize">
            {weekRangeLabel}
          </p>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={goToPreviousWeek}
            aria-label="Semana anterior"
            title="Semana anterior"
            className="p-1.5 sm:p-2 rounded-lg bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] hover:border-[var(--hc-accent-border)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hc-focus-ring)]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={goToCurrentWeek}
            disabled={isCurrentWeekSelected}
            aria-label="Ir para semana atual"
            className={`px-2.5 py-1.5 sm:py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hc-focus-ring)] ${
              isCurrentWeekSelected
                ? 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] text-[var(--hc-text-muted)] cursor-default'
                : 'bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] hover:border-[var(--hc-accent-border)]'
            }`}
          >
            Semana atual
          </button>

          <button
            type="button"
            onClick={goToNextWeek}
            aria-label="Próxima semana"
            title="Próxima semana"
            className="p-1.5 sm:p-2 rounded-lg bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] hover:border-[var(--hc-accent-border)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hc-focus-ring)]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <Calendar className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm font-medium leading-relaxed">{error}</p>
          </div>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading State: shown if loading and (no data or data is from a different week) and not in error */}
      {loading && (!data || isStale) && !error && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]"
              />
            ))}
          </div>
          <div className="h-14 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]"
              />
            ))}
          </div>
        </div>
      )}

      {/* Content Rendered: only when data belongs to the currently selected week and no active error */}
      {data && !isStale && !error && (
        <div className="space-y-4">
          {/* Top 4 Indicator Metric Cards */}
          <WeeklyMetricCards summary={data.summary} />

          {/* Contextual Smart Insight Banner */}
          <WeeklyInsightCard insight={data.contextualInsight} summary={data.summary} />

          {/* 7-Day Visual Comparison Chart */}
          <WeeklyChart days={data.days} />
        </div>
      )}
    </section>
  );
};

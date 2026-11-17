import React from 'react';
import { Sparkles, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { WeeklySummary } from '../../../types/weekly-summary';

interface WeeklyInsightCardProps {
  insight: string;
  summary: WeeklySummary;
}

export const WeeklyInsightCard: React.FC<WeeklyInsightCardProps> = ({ insight, summary }) => {
  const getIcon = () => {
    if (summary.isFutureWeek) return Calendar;
    if (summary.inProgressDaysCount > 0) return Clock;
    if (summary.totalWorkedMinutes >= summary.plannedExpectedMinutes && summary.plannedExpectedMinutes > 0) {
      return CheckCircle2;
    }
    return Sparkles;
  };

  const IconComponent = getIcon();

  return (
    <div className="flex items-start sm:items-center gap-3 p-3.5 sm:p-4 rounded-xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-xs">
      <div className="p-2 rounded-lg bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] text-[var(--hc-accent)] shrink-0 mt-0.5 sm:mt-0">
        <IconComponent className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--hc-accent)] tracking-wide uppercase">
            Visão da semana
          </span>
          {summary.isCurrentWeek && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-[var(--hc-text-secondary)]">
              Semana atual
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-[var(--hc-text)] font-medium mt-0.5 leading-relaxed">
          {insight}
        </p>
      </div>
    </div>
  );
};

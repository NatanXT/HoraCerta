import React from 'react';
import { WeeklyDaySummary } from '../../../types/weekly-summary';
import { formatHoursMinutes, formatSignedBalanceHoursMinutes } from '../../../utils/time';
import { getTodayDateStr } from '../../../utils/date';
import { CheckCircle2, Coffee, Sparkles, AlertCircle, PlusCircle } from 'lucide-react';

interface WeeklyChartProps {
  days: WeeklyDaySummary[];
}

export const WeeklyChart: React.FC<WeeklyChartProps> = ({ days }) => {
  const todayStr = getTodayDateStr();

  const getStatusBadge = (day: WeeklyDaySummary) => {
    const hasWork = day.totalWorkedMinutes > 0 || day.hasEntries;

    if (day.holidayName) {
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 truncate max-w-full"
          title={`Feriado: ${day.holidayName}${hasWork ? ' (com trabalho registrado)' : ''}`}
        >
          <Sparkles className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">
            {hasWork ? `${day.holidayName} (Trabalhado)` : day.holidayName}
          </span>
        </span>
      );
    }

    if (day.occurrenceType) {
      const label = day.occurrenceDescription || 'Ausência';
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 truncate max-w-full"
          title={`Ausência: ${label}${hasWork ? ' (com trabalho registrado)' : ''}`}
        >
          <Coffee className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">
            {hasWork ? `${label} (Trabalhado)` : label}
          </span>
        </span>
      );
    }

    // Work on rest day without planned schedule (not holiday, not absence, 0 expected minutes)
    const isRestDayWithWork = day.expectedMinutes === 0 && hasWork;
    if (isRestDayWithWork) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <PlusCircle className="w-2.5 h-2.5 shrink-0" />
          Trabalho em folga
        </span>
      );
    }

    switch (day.status) {
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] border border-[var(--hc-accent-border)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--hc-accent)] animate-pulse" />
            Em andamento
          </span>
        );
      case 'RECORDED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
            Encerrada
          </span>
        );
      case 'REST_DAY':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] border border-[var(--hc-border)]">
            Folga planejada
          </span>
        );
      case 'INCOMPLETE':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
            Incompleto
          </span>
        );
      case 'FUTURE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] border border-[var(--hc-border)]">
            Dia futuro
          </span>
        );
      case 'NO_RECORDS':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] border border-[var(--hc-border)]">
            Sem registros
          </span>
        );
    }
  };

  const calculateProgressPercent = (worked: number, expected: number): number => {
    if (expected <= 0) {
      return 0; // Days with no goal do not return artificial progress
    }
    const ratio = (worked / expected) * 100;
    return Math.min(Math.max(ratio, 0), 100);
  };

  const getExpectedLabel = (day: WeeklyDaySummary) => {
    if (day.expectedMinutes > 0) {
      return formatHoursMinutes(day.expectedMinutes);
    }
    if (day.holidayName) {
      return 'Feriado';
    }
    if (day.occurrenceType) {
      return day.occurrenceDescription || 'Ausência';
    }
    return 'Folga';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-semibold text-[var(--hc-text)] tracking-tight">
          Visualização Diária (Segunda a Domingo)
        </h4>
        <span className="text-[11px] text-[var(--hc-text-muted)] hidden sm:inline">
          Meta vs. Realizado por dia
        </span>
      </div>

      {/* Grid: 1 col on small mobile, 2 cols on mobile, 4 on tablet, 7 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {days.map((day) => {
          const isToday = day.date === todayStr;
          const hasPlannedGoal = day.expectedMinutes > 0;
          const progressPercent = calculateProgressPercent(day.totalWorkedMinutes, day.expectedMinutes);
          const hasOvertime = day.totalWorkedMinutes > day.expectedMinutes && hasPlannedGoal;
          const isWorkWithoutGoal = day.expectedMinutes <= 0 && (day.totalWorkedMinutes > 0 || day.hasEntries);

          // Day date formatting: e.g. "16/11"
          const [, monthPart, dayPart] = day.date.split('-');
          const dateFormatted = `${dayPart}/${monthPart}`;

          return (
            <div
              key={day.date}
              className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                isToday
                  ? 'bg-[var(--hc-surface)] border-[var(--hc-accent)] shadow-sm ring-1 ring-[var(--hc-accent)]/20'
                  : 'bg-[var(--hc-surface)] border-[var(--hc-border)] hover:border-[var(--hc-border-subtle)]'
              }`}
            >
              {/* Day Header */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-xs font-bold text-[var(--hc-text)] tracking-tight">
                    {day.weekdayShort},{' '}
                    <span className="font-normal text-[var(--hc-text-secondary)]">{dateFormatted}</span>
                  </span>
                  {isToday && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--hc-accent)] text-white">
                      HOJE
                    </span>
                  )}
                </div>

                <div className="mb-2.5 min-h-[22px] flex items-center">
                  {getStatusBadge(day)}
                </div>

                {/* Progress bar: ONLY for days with a planned goal (> 0 expectedMinutes) */}
                {hasPlannedGoal ? (
                  <div className="space-y-1 mb-2">
                    <div className="h-1.5 w-full bg-[var(--hc-surface-raised)] rounded-full overflow-hidden border border-[var(--hc-border-subtle)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          hasOvertime
                            ? 'bg-emerald-500'
                            : day.isOpen
                            ? 'bg-[var(--hc-accent)]'
                            : progressPercent >= 100
                            ? 'bg-emerald-500'
                            : progressPercent > 0
                            ? 'bg-[var(--hc-accent)]'
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : isWorkWithoutGoal ? (
                  /* Neutral indicator for work without planned goal: NO percentage bar */
                  <div className="mb-2 min-h-[6px] flex items-center">
                    <span className="text-[10px] text-[var(--hc-text-muted)] font-medium italic">
                      Sem meta planejada
                    </span>
                  </div>
                ) : (
                  <div className="mb-2 min-h-[6px]" />
                )}
              </div>

              {/* Day Metrics */}
              <div className="pt-2 border-t border-[var(--hc-border-subtle)] space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--hc-text-secondary)]">Trabalhado</span>
                  <span
                    className={`font-semibold ${
                      day.totalWorkedMinutes > 0
                        ? 'text-[var(--hc-text)]'
                        : 'text-[var(--hc-text-muted)]'
                    }`}
                  >
                    {day.totalWorkedMinutes > 0 ? formatHoursMinutes(day.totalWorkedMinutes) : '0h 00min'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--hc-text-secondary)]">Previsto</span>
                  <span className="font-medium text-[var(--hc-text-secondary)]">
                    {getExpectedLabel(day)}
                  </span>
                </div>

                {/* Balance */}
                {day.balanceMinutes !== null && (
                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-[var(--hc-border-subtle)]">
                    <span className="text-[11px] text-[var(--hc-text-secondary)]">Saldo</span>
                    <span
                      className={`text-xs font-semibold ${
                        day.balanceMinutes > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : day.balanceMinutes < 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[var(--hc-text-muted)]'
                      }`}
                    >
                      {formatSignedBalanceHoursMinutes(day.balanceMinutes)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

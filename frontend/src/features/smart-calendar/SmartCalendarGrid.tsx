import React from 'react';
import {
  CalendarDays,
  Palmtree,
  CalendarOff,
  CheckCircle2,
  Clock,
  Wrench,
  TriangleAlert,
  TrendingUp,
  TrendingDown,
  CircleAlert,
} from 'lucide-react';
import { SmartCalendarGridData, SmartCalendarDay } from './types';
import { formatMinutes, formatBalance } from '../../utils/time';
import { AppTooltip } from '../../components/ui/AppTooltip';
import { DayTooltipContent } from '../../components/history/DayTooltipContent';

export interface SmartCalendarGridProps {
  gridData: SmartCalendarGridData;
  selectedDayDate: string | null;
  onSelectDay: (dateStr: string) => void;
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const SmartCalendarGrid: React.FC<SmartCalendarGridProps> = ({
  gridData,
  selectedDayDate,
  onSelectDay,
}) => {
  return (
    <section
      aria-label="Calendário mensal inteligente"
      className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-3 sm:p-5 shadow-sm space-y-3.5"
    >
      {/* Weekday Header Row (Monday-first) */}
      <div className="grid grid-cols-7 text-center border-b border-[var(--hc-border)] pb-2.5">
        {WEEKDAY_HEADERS.map((header) => (
          <span
            key={header}
            className="text-xs font-bold uppercase tracking-wider text-[var(--hc-text-secondary)]"
          >
            {header}
          </span>
        ))}
      </div>

      {/* Grid of Day Cells */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {/* Empty Lead-in Slots before Day 1 */}
        {Array.from({ length: gridData.leadInSlots }).map((_, i) => (
          <div
            key={`lead-in-${i}`}
            className="h-16 sm:h-20 rounded-xl bg-[var(--hc-surface-raised)] border border-transparent opacity-40"
            aria-hidden="true"
          />
        ))}

        {/* Month Day Cells */}
        {gridData.days.map((day: SmartCalendarDay) => {
          const isSelected = selectedDayDate === day.summary.date;
          const { indicators } = day;

          // Determine cell container styling
          let cellBgClass = 'bg-[var(--hc-surface)] text-[var(--hc-text)]';
          if (indicators.isDataUnavailable) {
            cellBgClass = 'bg-[var(--hc-surface-raised)]/60 border-dashed border-[var(--hc-border)] text-[var(--hc-text-muted)]';
          } else if (indicators.isOpenWorkday) {
            cellBgClass = 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60';
          } else if (indicators.isPendingOrIncomplete) {
            cellBgClass = 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60';
          } else if (indicators.isVacation || indicators.isAbsenceOrLeave) {
            cellBgClass = 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60';
          } else if (indicators.isHoliday) {
            cellBgClass = 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60';
          } else if (indicators.isRestDay) {
            cellBgClass = 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] text-[var(--hc-text-muted)] opacity-85';
          } else if (indicators.isFuture) {
            cellBgClass = 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] text-[var(--hc-text-muted)] opacity-60';
          }

          return (
            <AppTooltip
              key={day.summary.date}
              content={<DayTooltipContent day={day.summary} />}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day.summary.date)}
                aria-label={day.ariaLabel}
                aria-pressed={isSelected}
                className={`h-16 sm:h-20 p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 relative cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--hc-accent)] group ${cellBgClass} ${
                  isSelected
                    ? 'ring-2 ring-[var(--hc-focus-ring)] border-[var(--hc-accent)] bg-[var(--hc-surface-raised)] shadow-md z-10'
                    : 'border-[var(--hc-border)]'
                }`}
              >
                {/* Header Row: Day Number & Multi-Indicator Icons Bar */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs sm:text-sm font-bold font-mono ${
                      indicators.isToday
                        ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--hc-accent)] text-white flex items-center justify-center font-extrabold shadow-xs'
                        : isSelected
                        ? 'text-[var(--hc-accent)] font-extrabold'
                        : 'text-[var(--hc-text)]'
                    }`}
                  >
                    {day.dayNumber}
                  </span>

                  {/* Coexisting Indicator Glyphs */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    {/* Dados Indisponíveis */}
                    {indicators.isDataUnavailable && (
                      <span title="Dados indisponíveis" className="text-amber-500">
                        <CircleAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                      </span>
                    )}

                    {/* Feriado */}
                    {indicators.isHoliday && (
                      <span title={day.summary.holiday?.name || 'Feriado'} className="text-amber-500">
                        <CalendarDays className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                      </span>
                    )}

                    {/* Férias */}
                    {indicators.isVacation && (
                      <span title="Férias" className="text-blue-500">
                        <Palmtree className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                      </span>
                    )}

                    {/* Ausência / Afastamento */}
                    {indicators.isAbsenceOrLeave && (
                      <span title={day.summary.occurrence?.title || 'Ausência'} className="text-indigo-400">
                        <CalendarOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                      </span>
                    )}

                    {/* Ajuste Manual */}
                    {indicators.hasManualAdjustment && (
                      <span title="Contém ajuste manual" className="text-cyan-500">
                        <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                      </span>
                    )}

                    {/* Pendência / Incompleto */}
                    {indicators.isPendingOrIncomplete && (
                      <span title="Jornada incompleta" className="text-amber-500">
                        <TriangleAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                      </span>
                    )}

                    {/* Jornada em Andamento */}
                    {indicators.isOpenWorkday && (
                      <span title="Expediente em andamento" className="text-emerald-500">
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" aria-hidden="true" />
                      </span>
                    )}

                    {/* Jornada Concluída */}
                    {indicators.isCompletedWorkday && (
                      <span title="Jornada registrada" className="text-emerald-500">
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Row: Hours / Balance / Special Labels */}
                <div className="overflow-hidden text-ellipsis whitespace-nowrap w-full">
                  {day.summary.totalWorkedMinutes > 0 ? (
                    <div>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--hc-text)] block">
                        {formatMinutes(day.summary.totalWorkedMinutes)}
                      </span>
                      {day.summary.balanceMinutes !== null && day.summary.balanceMinutes !== 0 ? (
                        <span
                          className={`text-[9px] sm:text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                            indicators.isPositiveBalance ? 'text-emerald-500' : 'text-amber-500'
                          }`}
                        >
                          {indicators.isPositiveBalance ? (
                            <TrendingUp className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <TrendingDown className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                          )}
                          <span>{formatBalance(day.summary.balanceMinutes)}</span>
                        </span>
                      ) : day.summary.balanceMinutes === 0 ? (
                        <span className="text-[9px] sm:text-[10px] font-mono text-[var(--hc-text-muted)] block">
                          00h00
                        </span>
                      ) : null}
                    </div>
                  ) : indicators.isDataUnavailable ? (
                    <span className="text-[9px] sm:text-[10px] text-amber-500/80 font-medium block truncate">
                      Indisponível
                    </span>
                  ) : indicators.isVacation ? (
                    <span className="text-[9px] sm:text-[10px] text-blue-400 font-medium block truncate">
                      Férias
                    </span>
                  ) : indicators.isHoliday ? (
                    <span className="text-[9px] sm:text-[10px] text-amber-500 font-medium block truncate">
                      {day.summary.holiday?.name || 'Feriado'}
                    </span>
                  ) : indicators.isAbsenceOrLeave ? (
                    <span className="text-[9px] sm:text-[10px] text-indigo-400 font-medium block truncate">
                      {day.summary.occurrence?.title || 'Abonado'}
                    </span>
                  ) : indicators.isRestDay ? (
                    <span className="text-[9px] sm:text-[10px] text-[var(--hc-text-muted)] font-medium block truncate">
                      Folga
                    </span>
                  ) : indicators.isFuture ? (
                    <span className="text-[9px] sm:text-[10px] text-[var(--hc-text-muted)] font-medium block truncate">
                      —
                    </span>
                  ) : (
                    <span className="text-[9px] sm:text-[10px] text-[var(--hc-text-secondary)] font-medium block truncate">
                      Sem reg.
                    </span>
                  )}
                </div>
              </button>
            </AppTooltip>
          );
        })}

        {/* Empty Lead-out Slots after Last Day */}
        {Array.from({ length: gridData.leadOutSlots }).map((_, i) => (
          <div
            key={`lead-out-${i}`}
            className="h-16 sm:h-20 rounded-xl bg-[var(--hc-surface-raised)] border border-transparent opacity-40"
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Accessible Legend of Indicators */}
      <div className="pt-3 border-t border-[var(--hc-border)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--hc-text-secondary)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Concluída</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Em andamento</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
            <span>Feriado</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Palmtree className="w-3.5 h-3.5 text-blue-500" />
            <span>Férias</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarOff className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ausência</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-cyan-500" />
            <span>Ajuste manual</span>
          </span>
        </div>
        <span className="text-[10px] text-[var(--hc-text-muted)]">
          Segunda-feira como início de semana
        </span>
      </div>
    </section>
  );
};

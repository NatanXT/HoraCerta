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
  ChevronRight,
  CircleAlert,
} from 'lucide-react';
import { SmartCalendarGridData, SmartCalendarDay } from './types';
import { formatMinutes, formatBalance, formatTime } from '../../utils/time';

export interface SmartCalendarListViewProps {
  gridData: SmartCalendarGridData;
  selectedDayDate: string | null;
  onSelectDay: (dateStr: string) => void;
}

export const SmartCalendarListView: React.FC<SmartCalendarListViewProps> = ({
  gridData,
  selectedDayDate,
  onSelectDay,
}) => {
  return (
    <section
      aria-label="Lista mensal de jornadas"
      className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[var(--hc-border)]">
        <div>
          <h3 className="text-sm font-bold text-[var(--hc-text)] tracking-tight">
            Visualização em Lista — {gridData.days.length} dias
          </h3>
          <p className="text-xs text-[var(--hc-text-secondary)]">
            Consulte os registros diários em formato corrido.
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--hc-border)]">
        {gridData.days.map((day: SmartCalendarDay) => {
          const isSelected = selectedDayDate === day.summary.date;
          const { indicators } = day;

          return (
            <button
              type="button"
              key={day.summary.date}
              onClick={() => onSelectDay(day.summary.date)}
              aria-label={day.ariaLabel}
              aria-pressed={isSelected}
              className={`w-full text-left p-3 sm:p-4 rounded-xl transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)] ${
                isSelected
                  ? 'bg-[var(--hc-surface-raised)] border border-[var(--hc-accent)] shadow-xs'
                  : 'hover:bg-[var(--hc-surface-raised)] border border-transparent'
              }`}
            >
              {/* Left Column: Date & Weekday & Primary Badges */}
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                    indicators.isToday
                      ? 'bg-[var(--hc-accent)] text-white border-[var(--hc-accent)] font-bold shadow-xs'
                      : isSelected
                      ? 'bg-[var(--hc-surface-raised)] text-[var(--hc-accent)] border-[var(--hc-accent)]'
                      : 'bg-[var(--hc-surface-raised)] text-[var(--hc-text)] border-[var(--hc-border)]'
                  }`}
                >
                  <span className="text-xs font-mono font-bold leading-none">{day.dayNumber}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 mt-0.5">
                    {day.weekdayShort}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--hc-text)]">
                      {day.weekdayLong}
                    </span>

                    {indicators.isToday && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] border border-[var(--hc-border)]">
                        Hoje
                      </span>
                    )}

                    {/* Status badges */}
                    {indicators.isDataUnavailable && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                        <CircleAlert className="w-3 h-3" />
                        Dados indisponíveis
                      </span>
                    )}
                    {indicators.isOpenWorkday && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-pulse" />
                        Em andamento
                      </span>
                    )}

                    {indicators.isCompletedWorkday && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Registrado
                      </span>
                    )}

                    {indicators.isHoliday && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {day.summary.holiday?.name || 'Feriado'}
                      </span>
                    )}

                    {indicators.isVacation && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                        <Palmtree className="w-3 h-3" />
                        Férias
                      </span>
                    )}

                    {indicators.isAbsenceOrLeave && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                        <CalendarOff className="w-3 h-3" />
                        {day.summary.occurrence?.title || 'Ausência'}
                      </span>
                    )}

                    {indicators.hasManualAdjustment && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        Ajuste manual
                      </span>
                    )}

                    {indicators.isPendingOrIncomplete && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                        <TriangleAlert className="w-3 h-3" />
                        Incompleto
                      </span>
                    )}

                    {indicators.isRestDay && !indicators.isCompletedWorkday && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--hc-surface)] text-[var(--hc-text-muted)] border border-[var(--hc-border)]">
                        Folga semanal
                      </span>
                    )}
                  </div>

                  {/* Batidas timeline summary */}
                  {day.summary.entries.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--hc-text-secondary)] font-mono">
                      <span>Pontos:</span>
                      {day.summary.entries.map((entry, idx) => (
                        <span key={entry.id || idx} className="bg-[var(--hc-surface)] px-1.5 py-0.5 rounded border border-[var(--hc-border)] text-[11px]">
                          {formatTime(entry.timestamp)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--hc-text-muted)]">
                      {indicators.isDataUnavailable
                        ? 'Dados não fornecidos pelo servidor para esta data'
                        : indicators.isRestDay
                        ? 'Sem expediente programado'
                        : indicators.isHoliday
                        ? 'Feriado nacional'
                        : indicators.isVacation
                        ? 'Período de férias regulamentares'
                        : indicators.isFuture
                        ? 'Dia futuro'
                        : 'Nenhum ponto registrado'}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Worked Minutes, Daily Balance & Arrow */}
              <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pl-14 sm:pl-0">
                {/* Worked Time */}
                <div className="text-right">
                  <span className="text-[10px] text-[var(--hc-text-secondary)] block">Trabalhado</span>
                  <strong className="text-xs sm:text-sm font-mono font-bold text-[var(--hc-text)]">
                    {indicators.isDataUnavailable
                      ? '—'
                      : day.summary.totalWorkedMinutes > 0
                      ? formatMinutes(day.summary.totalWorkedMinutes)
                      : '00h00'}
                  </strong>
                </div>

                {/* Daily Balance */}
                <div className="text-right min-w-[70px]">
                  <span className="text-[10px] text-[var(--hc-text-secondary)] block">Saldo diário</span>
                  {indicators.isDataUnavailable ? (
                    <span className="text-xs font-mono text-[var(--hc-text-muted)]">—</span>
                  ) : day.summary.balanceMinutes !== null ? (
                    <strong
                      className={`text-xs sm:text-sm font-mono font-bold flex items-center justify-end gap-0.5 ${
                        indicators.isPositiveBalance
                          ? 'text-emerald-500'
                          : indicators.isNegativeBalance
                          ? 'text-amber-500'
                          : 'text-[var(--hc-text-muted)]'
                      }`}
                    >
                      {indicators.isPositiveBalance && <TrendingUp className="w-3 h-3" />}
                      {indicators.isNegativeBalance && <TrendingDown className="w-3 h-3" />}
                      <span>{formatBalance(day.summary.balanceMinutes)}</span>
                    </strong>
                  ) : (
                    <span className="text-xs font-mono text-[var(--hc-text-muted)]">—</span>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-[var(--hc-text-muted)] hidden sm:block" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

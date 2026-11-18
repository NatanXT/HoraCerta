import React, { useState } from 'react';
import {
  CheckCircle2,
  TriangleAlert,
  Wrench,
  PencilLine,
  CalendarOff,
  Coffee,
  CalendarDays,
  Palmtree,
  TrendingUp,
  TrendingDown,
  CircleAlert,
} from 'lucide-react';
import { MonthlyDaySummary } from '../../types/work-day';
import { formatHolidayTypeLabel } from '../../types/holiday';
import { CALENDAR_OCCURRENCE_TYPE_LABELS } from '../../types/calendar-occurrence';
import { formatMinutes, formatBalance, formatTime } from '../../utils/time';
import { formatFullDate, getTodayDateStr } from '../../utils/date';
import { ManualAdjustmentPanel } from '../../components/history/ManualAdjustmentPanel';
import { resolveDayIndicators, getWeekdayNamesForDate } from './smart-calendar-calculator';

export interface SmartCalendarDayDetailProps {
  day: MonthlyDaySummary | null;
  onDayUpdated?: () => void;
}

export const SmartCalendarDayDetail: React.FC<SmartCalendarDayDetailProps> = ({
  day,
  onDayUpdated,
}) => {
  // Fix: Associa o ajuste explicitamente à data em que foi aberto para impedir troca acidental de alvo
  const [adjustingDay, setAdjustingDay] = useState<MonthlyDaySummary | null>(null);

  if (!day) {
    return (
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 text-center text-[var(--hc-text-secondary)] text-sm shadow-sm">
        Selecione um dia no calendário ou na lista para consultar o detalhamento da jornada.
      </div>
    );
  }

  const todayStr = getTodayDateStr();
  const indicators = resolveDayIndicators(day, todayStr);
  const { long: weekdayLong } = getWeekdayNamesForDate(day.date);

  const canAdjust = indicators.isPast && !indicators.isFuture && !indicators.isDataUnavailable;
  const isPending = indicators.isPendingOrIncomplete;

  const fullDateLabel = `${weekdayLong}, ${formatFullDate(day.date)}`;
  const sortedEntries = [...(day.entries || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const handleSaved = () => {
    setAdjustingDay(null);
    onDayUpdated?.();
  };

  return (
    <div className="space-y-4">
      <section
        aria-label="Detalhamento do dia selecionado"
        className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 backdrop-blur-sm"
      >
        {/* Header & Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[var(--hc-border)] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-[var(--hc-text)] tracking-tight">
                {fullDateLabel}
              </h3>
              {indicators.isToday && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] border border-[var(--hc-border)]">
                  Hoje
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5">
              Detalhamento de registros de ponto, pausas e saldo diário consolidado.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Multiple Coexisting Badges */}
            {indicators.isDataUnavailable && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1.5">
                <CircleAlert className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Dados indisponíveis</span>
              </span>
            )}
            {indicators.isOpenWorkday && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Expediente em andamento</span>
              </span>
            )}

            {indicators.isCompletedWorkday && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Jornada concluída</span>
              </span>
            )}

            {indicators.isHoliday && day.holiday && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Feriado: {day.holiday.name}</span>
              </span>
            )}

            {indicators.isVacation && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 inline-flex items-center gap-1.5">
                <Palmtree className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Férias regulamentares</span>
              </span>
            )}

            {indicators.isAbsenceOrLeave && day.occurrence && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 inline-flex items-center gap-1.5">
                <CalendarOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {CALENDAR_OCCURRENCE_TYPE_LABELS[day.occurrence.type] || day.occurrence.title}
                </span>
              </span>
            )}

            {indicators.isPendingOrIncomplete && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1.5">
                <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Jornada incompleta</span>
              </span>
            )}

            {indicators.hasManualAdjustment && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 inline-flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ajuste manual</span>
              </span>
            )}

            {indicators.isRestDay && !indicators.isCompletedWorkday && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--hc-surface-raised)] text-[var(--hc-text-secondary)] border border-[var(--hc-border)]">
                Folga semanal
              </span>
            )}

            {indicators.isFuture && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] border border-[var(--hc-border)]">
                Data futura
              </span>
            )}

            {/* Manual Adjustment Action Button */}
            {canAdjust && !adjustingDay && (
              <button
                type="button"
                onClick={() => setAdjustingDay(day)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  isPending
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30'
                    : 'bg-[var(--hc-accent-soft)] hover:bg-[var(--hc-accent)]/20 text-[var(--hc-accent)] border-[var(--hc-border)]'
                }`}
              >
                {isPending ? (
                  <>
                    <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resolver pendência</span>
                  </>
                ) : (
                  <>
                    <PencilLine className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ajustar registros</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Previsto */}
          <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
            <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
              Jornada Prevista
            </span>
            <strong className="text-sm sm:text-base font-mono font-bold text-[var(--hc-text)] block mt-0.5">
              {indicators.isDataUnavailable
                ? '—'
                : day.expectedMinutes > 0
                ? formatMinutes(day.expectedMinutes)
                : '00h00'}
            </strong>
            <span className="text-[10px] text-[var(--hc-text-muted)] block mt-0.5">
              {indicators.isDataUnavailable
                ? 'Não informado'
                : day.expectedMinutes > 0
                ? 'Conforme escala'
                : 'Sem expediente previsto'}
            </span>
          </div>

          {/* Card 2: Trabalhado */}
          <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
            <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
              Tempo Trabalhado
            </span>
            <strong className="text-sm sm:text-base font-mono font-bold text-[var(--hc-text)] block mt-0.5">
              {indicators.isDataUnavailable
                ? '—'
                : day.totalWorkedMinutes > 0
                ? formatMinutes(day.totalWorkedMinutes)
                : '00h00'}
            </strong>
            <span className="text-[10px] text-[var(--hc-text-muted)] block mt-0.5">
              {indicators.isDataUnavailable
                ? 'Não informado'
                : indicators.isOpenWorkday
                ? 'Em apuração contínua'
                : day.totalWorkedMinutes > 0
                ? 'Consolidado'
                : 'Nenhum ponto registrado'}
            </span>
          </div>

          {/* Card 3: Saldo Diário Oficial */}
          <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
            <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
              Saldo Diário Oficial
            </span>
            <strong
              className={`text-sm sm:text-base font-mono font-bold flex items-center gap-1 mt-0.5 ${
                indicators.isPositiveBalance
                  ? 'text-emerald-500'
                  : indicators.isNegativeBalance
                  ? 'text-amber-500'
                  : 'text-[var(--hc-text)]'
              }`}
            >
              {indicators.isPositiveBalance && <TrendingUp className="w-3.5 h-3.5" />}
              {indicators.isNegativeBalance && <TrendingDown className="w-3.5 h-3.5" />}
              <span>
                {indicators.isDataUnavailable
                  ? '—'
                  : day.balanceMinutes !== null
                  ? formatBalance(day.balanceMinutes)
                  : '—'}
              </span>
            </strong>
            <span className="text-[10px] text-[var(--hc-text-muted)] block mt-0.5">
              {indicators.isDataUnavailable
                ? 'Não apurado'
                : day.balanceMinutes !== null
                ? day.balanceMinutes > 0
                  ? 'Crédito diário'
                  : day.balanceMinutes < 0
                  ? 'Débito diário'
                  : 'Jornada exata'
                : 'Sem apuração'}
            </span>
          </div>

          {/* Card 4: Pausas do Dia */}
          <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
            <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
              Pausas Registradas
            </span>
            <strong className="text-sm sm:text-base font-mono font-bold text-[var(--hc-text)] block mt-0.5">
              {indicators.isDataUnavailable
                ? '—'
                : day.workBreaks && day.workBreaks.length > 0
                ? `${day.workBreaks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0)} min`
                : '0 min'}
            </strong>
            <span className="text-[10px] text-[var(--hc-text-muted)] block mt-0.5">
              {indicators.isDataUnavailable
                ? 'Sem dados'
                : day.workBreaks && day.workBreaks.length > 0
                ? `${day.workBreaks.length} ${day.workBreaks.length === 1 ? 'intervalo' : 'intervalos'}`
                : 'Nenhuma pausa registrada'}
            </span>
          </div>
        </div>

        {/* Timeline of Time Entries or Data Unavailable Alert */}
        {indicators.isDataUnavailable ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <CircleAlert className="w-4 h-4 shrink-0" />
              <span>Informações não fornecidas pelo servidor</span>
            </div>
            <p className="text-[var(--hc-text-secondary)]">
              Os registros deste dia não foram retornados na consulta mensal. Recarregue a página ou tente novamente mais tarde.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 pt-2 border-t border-[var(--hc-border)]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[var(--hc-text)] uppercase tracking-wider">
                Registros de Ponto do Dia
              </h4>
              <span className="text-[11px] text-[var(--hc-text-muted)] font-mono">
                {sortedEntries.length} {sortedEntries.length === 1 ? 'batida' : 'batidas'}
              </span>
            </div>

            {sortedEntries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {sortedEntries.map((entry, index) => {
                  const isClockIn = entry.type === 'CLOCK_IN';
                  return (
                    <div
                      key={entry.id || index}
                      className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isClockIn
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          }`}
                        >
                          {isClockIn ? 'E' : 'S'}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[var(--hc-text)] block">
                            {isClockIn ? 'Entrada' : 'Saída'} #{Math.floor(index / 2) + 1}
                          </span>
                          <span className="text-[10px] text-[var(--hc-text-muted)]">
                            {entry.source === 'MANUAL' ? 'Ajuste manual' : 'Relógio de ponto'}
                          </span>
                        </div>
                      </div>

                      <strong className="text-sm font-mono font-bold text-[var(--hc-text)]">
                        {formatTime(entry.timestamp)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-center text-xs text-[var(--hc-text-muted)]">
                {indicators.isRestDay
                  ? 'Dia de descanso semanal remunerado — sem pontos registrados.'
                  : indicators.isHoliday
                  ? `Feriado oficial (${day.holiday?.name}) — sem expediente obrigatório.`
                  : indicators.isVacation
                  ? 'Dia sob período de férias — registros dispensados.'
                  : indicators.isFuture
                  ? 'Data futura — expediente ainda não iniciado.'
                  : 'Nenhuma marcação de ponto realizada neste dia.'}
              </div>
            )}
          </div>
        )}

        {/* Work Breaks Details if present */}
        {day.workBreaks && day.workBreaks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--hc-border)]">
            <h4 className="text-xs font-bold text-[var(--hc-text)] uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-[var(--hc-accent)]" />
              <span>Intervalos e Pausas</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {day.workBreaks.map((b, idx) => (
                <div
                  key={b.id || idx}
                  className="p-2.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs flex items-center justify-between"
                >
                  <span className="text-[var(--hc-text-secondary)] font-medium">
                    {b.type === 'LUNCH' ? 'Refeição / Almoço' : 'Pausa / Descanso'}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[var(--hc-text-muted)]">
                      {formatTime(b.startedAt)} - {b.endedAt ? formatTime(b.endedAt) : 'Em andamento'}
                    </span>
                    <strong className="text-[var(--hc-text)]">
                      ({b.durationMinutes} min)
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feriados / Ocorrências Rich Box if present */}
        {(day.holiday || day.occurrence) && (
          <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs space-y-1">
            {day.holiday && (
              <div className="flex items-center gap-2 text-amber-500 font-semibold">
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span>
                  {formatHolidayTypeLabel(day.holiday.type)}: <strong>{day.holiday.name}</strong>
                </span>
              </div>
            )}
            {day.occurrence && (
              <div className="flex items-center gap-2 text-indigo-400 font-medium">
                <CalendarOff className="w-4 h-4 shrink-0" />
                <span>
                  Ocorrência: <strong>{day.occurrence.title}</strong> (
                  {CALENDAR_OCCURRENCE_TYPE_LABELS[day.occurrence.type] || day.occurrence.type})
                  {day.occurrence.note && <span className="text-[var(--hc-text-muted)] italic"> — {day.occurrence.note}</span>}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Manual Adjustment Modal/Panel if user clicked to adjust */}
      {adjustingDay && (
        <ManualAdjustmentPanel
          day={adjustingDay}
          onClose={() => setAdjustingDay(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

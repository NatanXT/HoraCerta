import { useState } from 'react';
import { CheckCircle2, TriangleAlert, Wrench, PencilLine, CalendarOff } from 'lucide-react';
import { MonthlyDaySummary } from '../../types/work-day';
import { CALENDAR_OCCURRENCE_TYPE_LABELS } from '../../types/calendar-occurrence';
import { formatMinutes, formatBalance, formatTime } from '../../utils/time';
import { formatFullDate, getTodayDateStr } from '../../utils/date';
import { ManualAdjustmentPanel } from './ManualAdjustmentPanel';

interface DayDetailsProps {
  day: MonthlyDaySummary | null;
  onDayUpdated?: () => void;
}

export function DayDetails({ day, onDayUpdated }: DayDetailsProps) {
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  if (!day) {
    return (
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-sm">
        Selecione um dia no calendário para visualizar os detalhes.
      </div>
    );
  }

  const todayStr = getTodayDateStr();
  const isPastDay = day.date < todayStr;
  const isPending = day.status === 'NO_RECORDS' || day.status === 'INCOMPLETE';
  const canAdjust = isPastDay && day.status !== 'FUTURE';

  const fullDateLabel = formatFullDate(day.date);
  const sortedEntries = [...day.entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const handleSaved = () => {
    setIsAdjusting(false);
    onDayUpdated?.();
  };

  return (
    <div className="space-y-4">
      <section aria-label="Detalhes do dia selecionado" className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-sm">
        {/* Header & Status Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800/80 gap-3">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {fullDateLabel}
            </h3>
            <p className="text-xs text-slate-400">Detalhamento dos registros e métricas do dia</p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            {/* Status Badge */}
            <div>
              {day.status === 'EXCUSED' && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1.5">
                  <CalendarOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{day.occurrence?.title || 'Jornada abonada'}</span>
                </span>
              )}
              {day.status === 'RECORDED' && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Dia registrado</span>
                </span>
              )}
              {day.status === 'IN_PROGRESS' && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Expediente em andamento</span>
                </span>
              )}
              {day.status === 'INCOMPLETE' && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1.5">
                  <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Jornada incompleta</span>
                </span>
              )}
              {day.status === 'NO_RECORDS' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
                  Sem registro
                </span>
              )}
              {day.status === 'REST_DAY' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
                  Folga
                </span>
              )}
              {day.status === 'FUTURE' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800/50 text-slate-500 border border-slate-800">
                  Data futura
                </span>
              )}
            </div>

            {/* Adjustment Action Button for Past Days */}
            {canAdjust && !isAdjusting && (
              <button
                type="button"
                onClick={() => setIsAdjusting(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  isPending
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
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

        {/* Occurrence Banner */}
        {day.occurrence && (
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-indigo-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-white">
              <CalendarOff className="w-4 h-4 text-indigo-400" />
              <span>
                {CALENDAR_OCCURRENCE_TYPE_LABELS[day.occurrence.type] || day.occurrence.type}: {day.occurrence.title}
              </span>
            </div>
            <p className="text-indigo-300/80">Jornada esperada zerada por esta ocorrência.</p>
            {day.occurrence.note && (
              <p className="text-slate-400 italic pt-1 font-sans">"{day.occurrence.note}"</p>
            )}
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Jornada esperada
            </span>
            <span className="text-xl font-bold text-slate-200 mt-0.5 block">
              {formatMinutes(day.expectedMinutes)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Trabalhado
            </span>
            <span className="text-xl font-bold text-white mt-0.5 block">
              {formatMinutes(day.totalWorkedMinutes)}
            </span>
          </div>

          {day.balanceMinutes !== null && (
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Saldo
              </span>
              <span
                className={`text-xl font-bold mt-0.5 block ${
                  day.balanceMinutes > 0
                    ? 'text-emerald-400'
                    : day.balanceMinutes === 0
                    ? 'text-slate-300'
                    : 'text-amber-400/90'
                }`}
              >
                {formatBalance(day.balanceMinutes)}
              </span>
            </div>
          )}
        </div>

        {/* Time Entries List */}
        {sortedEntries.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Registros do dia ({sortedEntries.length})
            </h4>
            <div className="divide-y divide-slate-800/50 bg-slate-950/40 rounded-xl border border-slate-800/60 px-3">
              {sortedEntries.map((entry) => {
                const isClockIn = entry.type === 'CLOCK_IN';
                const isManual = entry.source === 'MANUAL';

                return (
                  <div
                    key={entry.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          isClockIn ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <span className="text-sm font-medium text-slate-200">
                        {isClockIn ? 'Entrada' : 'Saída'}
                      </span>
                      {isManual && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1">
                          <PencilLine className="w-3 h-3" aria-hidden="true" />
                          <span>Manual</span>
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-mono font-bold text-white bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Embedded Manual Adjustment Panel */}
      {isAdjusting && (
        <ManualAdjustmentPanel
          day={day}
          onClose={() => setIsAdjusting(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

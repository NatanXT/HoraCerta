import { MonthlyDaySummary } from '../../types/work-day';
import { formatMinutes, formatBalance, formatTime } from '../../utils/time';
import { formatFullDate } from '../../utils/date';

interface DayDetailsProps {
  day: MonthlyDaySummary | null;
}

export function DayDetails({ day }: DayDetailsProps) {
  if (!day) {
    return (
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-sm">
        Selecione um dia no calendário para visualizar os detalhes.
      </div>
    );
  }

  const fullDateLabel = formatFullDate(day.date);
  const sortedEntries = [...day.entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <section aria-label="Detalhes do dia selecionado" className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-sm">
      {/* Header & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800/80 gap-3">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            {fullDateLabel}
          </h3>
          <p className="text-xs text-slate-400">Detalhamento dos registros e métricas do dia</p>
        </div>

        {/* Status Badge */}
        <div className="self-start sm:self-auto">
          {day.status === 'RECORDED' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ● Dia registrado
            </span>
          )}
          {day.status === 'IN_PROGRESS' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Expediente em andamento
            </span>
          )}
          {day.status === 'INCOMPLETE' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ⚠️ Jornada incompleta
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
      </div>

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

      {/* Explanatory Banner for Specific Statuses */}
      {day.status === 'INCOMPLETE' && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Este dia possui uma entrada sem saída correspondente. Ajuste manual será disponibilizado futuramente.
          </span>
        </div>
      )}

      {day.status === 'NO_RECORDS' && (
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs">
          Nenhum ponto registrado neste dia. (Jornada configurada: {formatMinutes(day.expectedMinutes)})
        </div>
      )}

      {day.status === 'REST_DAY' && (
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs">
          Folga programada.
        </div>
      )}

      {day.status === 'FUTURE' && (
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/40 text-slate-500 text-xs">
          Data futura.
        </div>
      )}

      {/* Time Entries List */}
      {sortedEntries.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Registros do dia ({sortedEntries.length})
          </h4>
          <div className="divide-y divide-slate-800/50 bg-slate-950/40 rounded-xl border border-slate-800/60 px-3">
            {sortedEntries.map((entry) => {
              const isClockIn = entry.type === 'CLOCK_IN';
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
  );
}

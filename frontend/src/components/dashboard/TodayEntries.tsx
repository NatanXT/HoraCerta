import { TimeEntry } from '../../types/work-day';
import { formatTime } from '../../utils/time';

interface TodayEntriesProps {
  entries: TimeEntry[];
}

export function TodayEntries({ entries }: TodayEntriesProps) {
  // Sort entries defensively by timestamp ASC
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <section aria-label="Registros de hoje" className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-md space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>Registros de hoje</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700/50">
            {entries.length}
          </span>
        </h2>
      </div>

      {sortedEntries.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto text-xl">
            📅
          </div>
          <p className="text-sm font-semibold text-slate-300">
            Nenhum ponto registrado hoje.
          </p>
          <p className="text-xs text-slate-500">
            Registre sua entrada para iniciar a jornada.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/50">
          {sortedEntries.map((entry) => {
            const isClockIn = entry.type === 'CLOCK_IN';
            return (
              <div
                key={entry.id}
                className="py-3.5 flex items-center justify-between transition-colors hover:bg-slate-800/30 px-2 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isClockIn ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400 shadow-sm shadow-rose-400/50'
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-200">
                    {isClockIn ? 'Entrada' : 'Saída'}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-white bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/50">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

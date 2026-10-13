import { CalendarDays } from 'lucide-react';
import { TimeEntry } from '../../types/work-day';
import { formatTime } from '../../utils/time';

interface TodayEntriesProps {
  entries: TimeEntry[];
}

export function TodayEntries({ entries }: TodayEntriesProps) {
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <section aria-label="Registros de hoje" className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-md space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--hc-border)]">
        <h2 className="text-base font-bold text-[var(--hc-text)] flex items-center gap-2">
          <span>Registros de hoje</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hc-surface-raised)] text-[var(--hc-text-secondary)] font-semibold border border-[var(--hc-border)]">
            {entries.length}
          </span>
        </h2>
      </div>

      {sortedEntries.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] flex items-center justify-center mx-auto shadow-inner">
            <CalendarDays className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[var(--hc-text)]">
            Nenhum ponto registrado hoje.
          </p>
          <p className="text-xs text-[var(--hc-text-muted)]">
            Registre sua entrada para iniciar a jornada.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--hc-border)]">
          {sortedEntries.map((entry) => {
            const isClockIn = entry.type === 'CLOCK_IN';
            return (
              <div
                key={entry.id}
                className="py-3.5 flex items-center justify-between transition-colors hover:bg-[var(--hc-surface-raised)] px-2 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isClockIn ? 'bg-emerald-500 shadow-sm' : 'bg-rose-500 shadow-sm'
                    }`}
                  />
                  <span className="text-sm font-medium text-[var(--hc-text)]">
                    {isClockIn ? 'Entrada' : 'Saída'}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-[var(--hc-text)] bg-[var(--hc-surface-raised)] px-3 py-1 rounded-lg border border-[var(--hc-border)]">
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

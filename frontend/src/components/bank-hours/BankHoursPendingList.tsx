import { Link } from 'react-router-dom';
import { CircleCheck, TriangleAlert, ArrowRight } from 'lucide-react';
import { BankHoursPendingDay } from '../../types/bank-hours';
import { formatMinutes } from '../../utils/time';
import { formatFullDate } from '../../utils/date';

interface BankHoursPendingListProps {
  pending: BankHoursPendingDay[];
}

export function BankHoursPendingList({ pending }: BankHoursPendingListProps) {
  if (pending.length === 0) {
    return (
      <section aria-label="Pendências de apuração" className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-md text-center space-y-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
          <CircleCheck className="w-5 h-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-[var(--hc-text)]">
          Nenhuma pendência de apuração.
        </p>
        <p className="text-xs text-[var(--hc-text-secondary)]">
          Todos os dias históricos elegíveis do período estão com apuração concluída.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Pendências de apuração" className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-md space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--hc-border)] gap-2">
        <h3 className="text-base font-bold text-[var(--hc-text)] flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 text-amber-500" aria-hidden="true" />
          <span>Pendências de apuração</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/20">
            {pending.length}
          </span>
        </h3>
        <p className="text-xs text-[var(--hc-text-secondary)]">
          Esses dias não entram no saldo até que possam ser tratados.
        </p>
      </div>

      <div className="divide-y divide-[var(--hc-border)]">
        {pending.map((p) => {
          const isNoRecords = p.status === 'NO_RECORDS';
          return (
            <div
              key={p.date}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 hover:bg-[var(--hc-surface-raised)] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-[var(--hc-text)]">
                  {formatFullDate(p.date)}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    isNoRecords
                      ? 'bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] border-[var(--hc-border)]'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}
                >
                  {isNoRecords ? 'Sem registro' : 'Jornada incompleta'}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-[var(--hc-text-secondary)] justify-between sm:justify-end">
                <div className="flex items-center gap-3">
                  <span>Jornada: <strong className="text-[var(--hc-text)]">{formatMinutes(p.expectedMinutes)}</strong></span>
                  <span>Registrado: <strong className="text-[var(--hc-text)]">{formatMinutes(p.totalWorkedMinutes)}</strong></span>
                </div>
                <Link
                  to={`/historico?date=${p.date}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--hc-accent)] hover:opacity-85 hover:underline transition-colors shrink-0 font-sans"
                >
                  <span>Revisar no histórico</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

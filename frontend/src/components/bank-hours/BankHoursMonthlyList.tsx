import { Calendar } from 'lucide-react';
import { BankHoursMonthlySummary } from '../../types/bank-hours';
import { formatMinutes, formatBalance } from '../../utils/time';
import { formatMonthLabel } from '../../utils/date';

interface BankHoursMonthlyListProps {
  monthly: BankHoursMonthlySummary[];
}

export function BankHoursMonthlyList({ monthly }: BankHoursMonthlyListProps) {
  if (monthly.length === 0) {
    return null;
  }

  return (
    <section aria-label="Resumo por mês do banco de horas" className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-md space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          <span>Resumo por mês</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700/50">
            {monthly.length}
          </span>
        </h3>
      </div>

      <div className="space-y-3">
        {monthly.map((m) => {
          const isNetPositive = m.netMinutes > 0;
          const isNetZero = m.netMinutes === 0;

          return (
            <div
              key={m.month}
              className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <h4 className="text-sm font-bold text-white">
                  {formatMonthLabel(m.month)}
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>Dias contabilizados: <strong className="text-slate-200">{m.accountedDays}</strong></span>
                  {m.pendingDays > 0 && (
                    <span className="text-amber-400 font-medium">Pendências: {m.pendingDays}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs sm:text-sm font-mono self-end sm:self-auto">
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block uppercase font-sans">Créditos</span>
                  <span className="text-emerald-400 font-bold">{formatMinutes(m.creditMinutes)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block uppercase font-sans">Débitos</span>
                  <span className="text-amber-400/90 font-bold">{formatMinutes(m.debitMinutes)}</span>
                </div>
                <div className="text-right pl-2 border-l border-slate-800">
                  <span className="text-slate-400 text-[10px] block uppercase font-sans">Saldo Mês</span>
                  <span
                    className={`font-bold ${
                      isNetPositive
                        ? 'text-emerald-400'
                        : isNetZero
                        ? 'text-slate-300'
                        : 'text-amber-400'
                    }`}
                  >
                    {formatBalance(m.netMinutes)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

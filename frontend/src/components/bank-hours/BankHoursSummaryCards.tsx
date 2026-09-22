import { LockKeyhole, Clock3, Zap } from 'lucide-react';
import { BankHoursSummary } from '../../types/bank-hours';
import { formatBalance } from '../../utils/time';

interface BankHoursSummaryCardsProps {
  summary: BankHoursSummary;
}

export function BankHoursSummaryCards({ summary }: BankHoursSummaryCardsProps) {
  const isConsolidatedPositive = summary.consolidatedBalanceMinutes > 0;
  const isConsolidatedZero = summary.consolidatedBalanceMinutes === 0;

  const isLivePositive = summary.liveBalanceMinutes > 0;
  const isLiveZero = summary.liveBalanceMinutes === 0;

  return (
    <section aria-label="Saldos do Banco de Horas" className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Saldo Consolidado */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Saldo consolidado
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <LockKeyhole className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div
            className={`text-3xl font-extrabold tracking-tight ${
              isConsolidatedPositive
                ? 'text-emerald-400'
                : isConsolidatedZero
                ? 'text-slate-300'
                : 'text-amber-400/90'
            }`}
          >
            {formatBalance(summary.consolidatedBalanceMinutes)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Fechado até ontem</div>
        </div>
      </div>

      {/* 2. Saldo de Hoje */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Saldo de hoje
          </span>
          <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center">
            <Clock3 className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="text-3xl font-extrabold tracking-tight">
            {summary.todayBalanceMinutes !== null ? (
              <span
                className={
                  summary.todayBalanceMinutes > 0
                    ? 'text-emerald-400'
                    : summary.todayBalanceMinutes === 0
                    ? 'text-slate-300'
                    : 'text-amber-400/90'
                }
              >
                {formatBalance(summary.todayBalanceMinutes)}
              </span>
            ) : (
              <span className="text-slate-500 text-2xl font-bold">Não iniciado</span>
            )}
          </div>
          <div className="text-xs text-indigo-300/80 mt-1 font-medium">Provisório do dia atual</div>
        </div>
      </div>

      {/* 3. Saldo Agora (Hero Card) */}
      <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
            Saldo agora
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shadow-inner">
            <Zap className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-sm ${
              isLivePositive
                ? 'text-emerald-400'
                : isLiveZero
                ? 'text-white'
                : 'text-amber-400'
            }`}
          >
            {formatBalance(summary.liveBalanceMinutes)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Consolidado + movimento de hoje</div>
        </div>
      </div>
    </section>
  );
}

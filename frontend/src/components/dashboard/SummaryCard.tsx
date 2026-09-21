import { WorkDaySummary } from '../../types/work-day';
import { formatMinutes, formatBalance } from '../../utils/time';

interface SummaryCardProps {
  summary: WorkDaySummary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const isPositive = summary.balanceMinutes > 0;
  const isZero = summary.balanceMinutes === 0;

  return (
    <section aria-label="Resumo da jornada" className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Trabalhado Hoje */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Trabalhado hoje
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-sm font-bold">
            ⏱
          </div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatMinutes(summary.totalWorkedMinutes)}
          </div>
          {summary.isOpen && summary.currentSessionMinutes > 0 && (
            <div className="text-xs text-indigo-300 mt-1 font-medium flex items-center gap-1">
              <span>Sessão atual:</span>
              <span className="font-bold">{formatMinutes(summary.currentSessionMinutes)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Jornada Esperada */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Jornada esperada
          </span>
          <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center text-sm font-bold">
            📋
          </div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-slate-200 tracking-tight">
            {formatMinutes(summary.expectedMinutes)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Carga diária esperada</div>
        </div>
      </div>

      {/* 3. Saldo de Hoje */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Saldo de hoje
          </span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400'
                : isZero
                ? 'bg-slate-800 text-slate-400'
                : 'bg-amber-500/10 text-amber-400'
            }`}
          >
            ⚖️
          </div>
        </div>
        <div>
          <div
            className={`text-3xl font-extrabold tracking-tight ${
              isPositive
                ? 'text-emerald-400'
                : isZero
                ? 'text-slate-300'
                : 'text-amber-400/90'
            }`}
          >
            {formatBalance(summary.balanceMinutes)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {summary.isOpen
              ? 'Saldo parcial em andamento'
              : summary.balanceMinutes > 0
              ? 'Saldo positivo do dia'
              : summary.balanceMinutes < 0
              ? 'Saldo parcial restante'
              : 'Jornada cumprida'}
          </div>
        </div>
      </div>
    </section>
  );
}

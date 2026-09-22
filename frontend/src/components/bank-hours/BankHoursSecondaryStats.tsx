import { TrendingUp, TrendingDown, CalendarCheck, TriangleAlert } from 'lucide-react';
import { BankHoursSummary } from '../../types/bank-hours';
import { formatMinutes } from '../../utils/time';

interface BankHoursSecondaryStatsProps {
  summary: BankHoursSummary;
}

export function BankHoursSecondaryStats({ summary }: BankHoursSecondaryStatsProps) {
  return (
    <section aria-label="Estatísticas do Banco de Horas" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Créditos Acumulados */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Créditos
          </span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
            {formatMinutes(summary.creditMinutes)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Horas excedentes acumuladas</div>
        </div>
      </div>

      {/* Débitos Acumulados */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Débitos
          </span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400/90 tracking-tight">
            {formatMinutes(summary.debitMinutes)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Horas devidas acumuladas</div>
        </div>
      </div>

      {/* Dias Contabilizados */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Dias contabilizados
          </span>
          <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center">
            <CalendarCheck className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {summary.accountedDays}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dias com apuração concluída</div>
        </div>
      </div>

      {/* Pendências de Apuração */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Pendências
          </span>
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              summary.pendingDays > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </div>
        <div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              summary.pendingDays > 0 ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            {summary.pendingDays}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dias sem apurar</div>
        </div>
      </div>
    </section>
  );
}

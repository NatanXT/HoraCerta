import { MonthlyHistorySummary } from '../../types/work-day';
import { formatMinutes } from '../../utils/time';

interface MonthlySummaryCardsProps {
  summary: MonthlyHistorySummary;
}

export function MonthlySummaryCards({ summary }: MonthlySummaryCardsProps) {
  return (
    <section aria-label="Resumo mensal descritivo" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Horas Registradas */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Horas registradas
        </span>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {formatMinutes(summary.totalWorkedMinutes)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Efetivamente trabalhadas</div>
        </div>
      </div>

      {/* 2. Dias com Registro */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Dias com registro
        </span>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">
            {summary.recordedDays}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Dias trabalhados</div>
        </div>
      </div>

      {/* 3. Dias sem Registro */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Dias sem registro
        </span>
        <div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-300 tracking-tight">
            {summary.daysWithoutRecords}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Jornada prevista sem ponto</div>
        </div>
      </div>

      {/* 4. Pendências / Incompletos */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Pendências
        </span>
        <div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              summary.incompleteDays > 0 ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            {summary.incompleteDays}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Sessões não encerradas</div>
        </div>
      </div>
    </section>
  );
}

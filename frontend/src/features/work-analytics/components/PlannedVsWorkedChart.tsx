import React from 'react';
import { AlertCircle } from 'lucide-react';
import { MonthlyAggregationItem } from '../types';
import { formatHoursMinutes, formatSignedBalanceHoursMinutes } from '../../../utils/time';

interface PlannedVsWorkedChartProps {
  aggregations: MonthlyAggregationItem[];
}

export const PlannedVsWorkedChart: React.FC<PlannedVsWorkedChartProps> = ({ aggregations }) => {
  if (aggregations.length === 0) {
    return null;
  }

  // Find max value across valid minutes to calibrate bar heights (minimum 60h for visual baseline)
  const validMinutes = aggregations.flatMap((a) => [
    a.totalWorkedMinutes ?? 0,
    a.totalExpectedMinutes ?? 0,
  ]);
  const maxMinutes = Math.max(3600, ...validMinutes);

  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--hc-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--hc-text)] tracking-tight">
              Horas Previstas versus Horas Trabalhadas
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Planejado vs. Real
            </span>
          </div>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5">
            Comparação mensal entre a jornada planejada na escala e o tempo efetivamente trabalhado.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-indigo-400" />
            <span className="text-[var(--hc-text-secondary)]">Previsto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-[var(--hc-text-secondary)]">Trabalhado</span>
          </div>
        </div>
      </div>

      {/* Grouped Bar Chart Visual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {aggregations.map((item) => {
          const isUnavailable = item.status === 'unavailable';

          if (isUnavailable) {
            return (
              <div
                key={item.month}
                className="p-3.5 rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 transition-all flex flex-col justify-between gap-3 min-h-[190px]"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[var(--hc-text)]">
                    {item.monthLabel}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    Indisponível
                  </span>
                </div>
                <div className="h-32 flex flex-col items-center justify-center text-center p-2 text-rose-500">
                  <AlertCircle className="w-6 h-6 mb-1 text-rose-400" aria-hidden="true" />
                  <span className="text-[11px] font-semibold">Dados indisponíveis</span>
                  <span className="text-[9px] text-[var(--hc-text-muted)] mt-0.5">Falha na consulta</span>
                </div>
                <div className="text-[10px] text-[var(--hc-text-muted)] text-center pt-1 border-t border-[var(--hc-border)]">
                  Não computado
                </div>
              </div>
            );
          }

          const expMin = item.totalExpectedMinutes ?? 0;
          const wrkMin = item.totalWorkedMinutes ?? 0;
          const diffMin = item.differenceMinutes ?? 0;

          const expectedHeightPercent = Math.min(100, Math.round((expMin / maxMinutes) * 100));
          const workedHeightPercent = Math.min(100, Math.round((wrkMin / maxMinutes) * 100));

          const isPositive = diffMin > 0;
          const isNegative = diffMin < 0;

          return (
            <div
              key={item.month}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                item.isCurrentMonth
                  ? 'bg-[var(--hc-surface-raised)] border-[var(--hc-accent)]/40 shadow-xs'
                  : 'bg-[var(--hc-surface)] border-[var(--hc-border)]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-[var(--hc-text)]">
                  {item.monthLabel}
                </span>
                {item.isCurrentMonth && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--hc-accent)] text-white">
                    Atual
                  </span>
                )}
              </div>

              {/* Vertical Bars Container (fixed height) */}
              <div className="h-32 flex items-end justify-center gap-3 pt-4 border-b border-[var(--hc-border)] pb-1">
                {/* Expected Bar */}
                <div className="flex flex-col items-center flex-1 max-w-[28px] h-full justify-end group relative">
                  <div
                    style={{ height: expMin > 0 ? `${Math.max(4, expectedHeightPercent)}%` : '0%' }}
                    className={`w-full transition-all duration-300 ${
                      expMin > 0 ? 'bg-indigo-400/80 rounded-t-md hover:opacity-90' : 'h-0'
                    }`}
                    title={`Previsto: ${formatHoursMinutes(expMin)}`}
                  />
                  <span className="text-[9px] text-[var(--hc-text-muted)] mt-1 font-mono">
                    {Math.round(expMin / 60)}h
                  </span>
                </div>

                {/* Worked Bar */}
                <div className="flex flex-col items-center flex-1 max-w-[28px] h-full justify-end group relative">
                  <div
                    style={{ height: wrkMin > 0 ? `${Math.max(4, workedHeightPercent)}%` : '0%' }}
                    className={`w-full transition-all duration-300 ${
                      wrkMin > 0
                        ? wrkMin >= expMin
                          ? 'bg-emerald-500 rounded-t-md hover:opacity-90'
                          : 'bg-amber-500 rounded-t-md hover:opacity-90'
                        : 'h-0'
                    }`}
                    title={`Trabalhado: ${formatHoursMinutes(wrkMin)}`}
                  />
                  <span className="text-[9px] text-[var(--hc-text-muted)] mt-1 font-mono font-bold">
                    {Math.round(wrkMin / 60)}h
                  </span>
                </div>
              </div>

              {/* Diff Metric below */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[11px] text-[var(--hc-text-muted)]">Saldo:</span>
                <span
                  className={`font-mono font-bold ${
                    isPositive
                      ? 'text-emerald-500'
                      : isNegative
                      ? 'text-rose-500'
                      : 'text-[var(--hc-text)]'
                  }`}
                >
                  {formatSignedBalanceHoursMinutes(diffMin)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accessible Table */}
      <details className="text-xs text-[var(--hc-text-secondary)]">
        <summary className="cursor-pointer font-semibold hover:text-[var(--hc-text)] transition-colors">
          Exibir tabela com valores numéricos detalhados
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--hc-border)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--hc-surface-raised)] border-b border-[var(--hc-border)]">
                <th className="p-2.5 font-bold">Competência</th>
                <th className="p-2.5 font-bold">Horas Previstas</th>
                <th className="p-2.5 font-bold">Horas Trabalhadas</th>
                <th className="p-2.5 font-bold">Diferença</th>
                <th className="p-2.5 font-bold">Dias com Ponto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hc-border)]">
              {aggregations.map((a) => {
                const isUnavailable = a.status === 'unavailable';
                return (
                  <tr key={a.month} className="hover:bg-[var(--hc-surface-raised)] transition-colors">
                    <td className="p-2.5 font-medium">
                      {a.monthLabel} {a.isCurrentMonth && '(Em andamento)'}
                    </td>
                    <td className="p-2.5 font-mono">
                      {isUnavailable ? 'Indisponível' : formatHoursMinutes(a.totalExpectedMinutes!)}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-emerald-500">
                      {isUnavailable ? 'Indisponível' : formatHoursMinutes(a.totalWorkedMinutes!)}
                    </td>
                    <td className="p-2.5 font-mono font-bold">
                      {isUnavailable ? '—' : formatSignedBalanceHoursMinutes(a.differenceMinutes!)}
                    </td>
                    <td className="p-2.5">
                      {isUnavailable ? '—' : `${a.recordedDaysCount} dias`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { MonthlyAggregationItem } from '../types';
import { formatHoursMinutes, formatSignedBalanceHoursMinutes } from '../../../utils/time';

interface MonthlyComparisonChartProps {
  aggregations: MonthlyAggregationItem[];
}

export const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({
  aggregations,
}) => {
  if (aggregations.length === 0) return null;

  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[var(--hc-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--hc-text)] tracking-tight">
              Comparativo Mensal Consolidado
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Histórico
            </span>
          </div>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5">
            Evolução comparativa entre competências mensais com indicadores de jornada e banco de horas.
          </p>
        </div>
      </div>

      {/* Grid of monthly summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {aggregations.map((item) => {
          const isUnavailable = item.status === 'unavailable';

          if (isUnavailable) {
            return (
              <div
                key={item.month}
                className="p-4 rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 flex flex-col justify-between gap-3 transition-all"
              >
                <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
                  <div>
                    <h4 className="text-sm font-bold text-[var(--hc-text)] tracking-tight">
                      {item.monthLabel}
                    </h4>
                    <span className="text-[10px] text-rose-500 block">
                      Não consultado
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    Indisponível
                  </span>
                </div>
                <div className="py-3 flex items-center gap-2 text-xs text-rose-500">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" aria-hidden="true" />
                  <span>{item.unavailableReason || 'Dados indisponíveis devido a falha na consulta desta competência.'}</span>
                </div>
              </div>
            );
          }

          const wrkMin = item.totalWorkedMinutes ?? 0;
          const expMin = item.totalExpectedMinutes ?? 0;
          const diffMin = item.differenceMinutes ?? 0;

          const isDiffPos = diffMin > 0;
          const isDiffNeg = diffMin < 0;

          return (
            <div
              key={item.month}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                item.isCurrentMonth
                  ? 'bg-[var(--hc-surface-raised)] border-[var(--hc-accent)]/50 shadow-xs'
                  : 'bg-[var(--hc-surface)] border-[var(--hc-border)]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--hc-border)]">
                <div>
                  <h4 className="text-sm font-bold text-[var(--hc-text)] tracking-tight">
                    {item.monthLabel}
                  </h4>
                  <span className="text-[10px] text-[var(--hc-text-muted)] block">
                    {item.recordedDaysCount} {item.recordedDaysCount === 1 ? 'dia trabalhado' : 'dias trabalhados'}
                  </span>
                </div>

                {item.isCurrentMonth ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--hc-accent-soft)] text-[var(--hc-accent)] border border-[var(--hc-accent-border)]">
                    Em andamento
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)] border border-[var(--hc-border)]">
                    Concluído
                  </span>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--hc-text-muted)] block">
                    Horas Trabalhadas
                  </span>
                  <span className="font-mono font-bold text-emerald-500 text-sm">
                    {formatHoursMinutes(wrkMin)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--hc-text-muted)] block">
                    Horas Previstas
                  </span>
                  <span className="font-mono font-medium text-[var(--hc-text)] text-sm">
                    {formatHoursMinutes(expMin)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--hc-text-muted)] block">
                    Diferença Líquida
                  </span>
                  <span
                    className={`font-mono font-bold text-xs ${
                      isDiffPos
                        ? 'text-emerald-500'
                        : isDiffNeg
                        ? 'text-rose-500'
                        : 'text-[var(--hc-text)]'
                    }`}
                  >
                    {formatSignedBalanceHoursMinutes(diffMin)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--hc-text-muted)] block">
                    Variação Banco
                  </span>
                  {item.isFractionOfCompetence ? (
                    <div>
                      <span className="font-mono font-bold text-xs text-[var(--hc-text-muted)]">
                        —
                      </span>
                      <span className="block text-[9px] text-[var(--hc-text-muted)] font-medium leading-tight">
                        Disponível apenas para competência integral
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono font-bold text-xs text-[var(--hc-text)]">
                      {item.isBankHoursActiveInMonth && item.bankHoursNetMinutes !== null
                        ? formatSignedBalanceHoursMinutes(item.bankHoursNetMinutes)
                        : '—'}
                    </span>
                  )}
                </div>
              </div>

              {item.hasIncompleteData && (
                <div className="text-[10px] text-amber-500 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                  Atenção: Alguns dias desta competência foram omitidos pelo servidor.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

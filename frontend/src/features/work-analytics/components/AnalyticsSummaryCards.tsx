import React from 'react';
import { Clock, Target, TrendingUp, TrendingDown, CalendarCheck, Landmark } from 'lucide-react';
import { AnalyticsSummaryMetrics } from '../types';
import { formatHoursMinutes, formatSignedBalanceHoursMinutes } from '../../../utils/time';

interface AnalyticsSummaryCardsProps {
  metrics: AnalyticsSummaryMetrics;
}

export const AnalyticsSummaryCards: React.FC<AnalyticsSummaryCardsProps> = ({ metrics }) => {
  const isDiffPositive = metrics.netDifferenceMinutes > 0;
  const isDiffNegative = metrics.netDifferenceMinutes < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. Total Trabalhado */}
      <div className="p-4 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-xs flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--hc-text-secondary)] font-medium">
          <div className="flex items-center gap-1.5">
            <span>Horas Trabalhadas</span>
            {metrics.isPartialCoverage && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Parcial
              </span>
            )}
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Clock className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        <div>
          <span className="text-xl sm:text-2xl font-extrabold text-[var(--hc-text)] tracking-tight font-mono block">
            {formatHoursMinutes(metrics.totalWorkedMinutes)}
          </span>
          <span className="text-[11px] text-[var(--hc-text-muted)] block mt-0.5">
            {metrics.isPartialCoverage
              ? `Dados parciais (${metrics.coverageDaysCount} de ${metrics.totalDaysInRange} dias civis)`
              : 'Total apurado no período'}
          </span>
        </div>
      </div>

      {/* 2. Total Previsto */}
      <div className="p-4 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-xs flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--hc-text-secondary)] font-medium">
          <div className="flex items-center gap-1.5">
            <span>Horas Previstas</span>
            {metrics.isPartialCoverage && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Parcial
              </span>
            )}
          </div>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Target className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        <div>
          <span className="text-xl sm:text-2xl font-extrabold text-[var(--hc-text)] tracking-tight font-mono block">
            {formatHoursMinutes(metrics.totalExpectedMinutes)}
          </span>
          <span className="text-[11px] text-[var(--hc-text-muted)] block mt-0.5">
            Escala pactuada até hoje
          </span>
        </div>
      </div>

      {/* 3. Diferença Líquida (Realizado vs Previsto) */}
      <div className="p-4 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-xs flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--hc-text-secondary)] font-medium">
          <span>Diferença Líquida</span>
          <div
            className={`p-1.5 rounded-lg ${
              isDiffPositive
                ? 'bg-emerald-500/10 text-emerald-500'
                : isDiffNegative
                ? 'bg-rose-500/10 text-rose-500'
                : 'bg-[var(--hc-surface-raised)] text-[var(--hc-text-muted)]'
            }`}
          >
            {isDiffPositive ? (
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            ) : isDiffNegative ? (
              <TrendingDown className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
        </div>
        <div>
          <span
            className={`text-xl sm:text-2xl font-extrabold tracking-tight font-mono block ${
              isDiffPositive
                ? 'text-emerald-500'
                : isDiffNegative
                ? 'text-rose-500'
                : 'text-[var(--hc-text)]'
            }`}
          >
            {formatSignedBalanceHoursMinutes(metrics.netDifferenceMinutes)}
          </span>
          <span className="text-[11px] text-[var(--hc-text-muted)] block mt-0.5">
            Realizado menos previsto
          </span>
        </div>
      </div>

      {/* 4. Média Diária por Dia Registrado */}
      <div className="p-4 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-xs flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--hc-text-secondary)] font-medium">
          <span>Média por Dia</span>
          <div className="p-1.5 rounded-lg bg-[var(--hc-accent-soft)] text-[var(--hc-accent)]">
            <CalendarCheck className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        <div>
          <span className="text-xl sm:text-2xl font-extrabold text-[var(--hc-text)] tracking-tight font-mono block">
            {formatHoursMinutes(metrics.averageWorkedMinutesPerRecordedDay)}
          </span>
          <span className="text-[11px] text-[var(--hc-text-muted)] block mt-0.5">
            Em {metrics.recordedDaysCount} {metrics.recordedDaysCount === 1 ? 'dia registrado' : 'dias registrados'}
          </span>
        </div>
      </div>

      {/* 5. Variação Oficial do Banco de Horas */}
      <div className="p-4 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-xs flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--hc-text-secondary)] font-medium">
          <span>Variação Banco</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Landmark className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
        <div>
          {metrics.bankHoursAvailability === 'configured' && metrics.officialBankHoursNetMinutes !== null ? (
            <>
              <span
                className={`text-xl sm:text-2xl font-extrabold tracking-tight font-mono block ${
                  metrics.officialBankHoursNetMinutes > 0
                    ? 'text-emerald-500'
                    : metrics.officialBankHoursNetMinutes < 0
                    ? 'text-rose-500'
                    : 'text-[var(--hc-text)]'
                }`}
              >
                {formatSignedBalanceHoursMinutes(metrics.officialBankHoursNetMinutes)}
              </span>
              <span className="text-[11px] text-[var(--hc-text-muted)] block mt-0.5">
                Variação líquida oficial
              </span>
            </>
          ) : metrics.bankHoursAvailability === 'statement_incomplete' ? (
            <>
              <span className="text-xl sm:text-2xl font-extrabold text-[var(--hc-text-secondary)] font-mono block">
                —
              </span>
              <span
                className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5"
                title={metrics.bankHoursAvailabilityReason}
              >
                Extrato incompleto
              </span>
            </>
          ) : metrics.bankHoursAvailability === 'partial_interval_unavailable' ? (
            <>
              <span className="text-xl sm:text-2xl font-extrabold text-[var(--hc-text-secondary)] font-mono block">
                —
              </span>
              <span
                className="text-[10px] text-[var(--hc-text-muted)] block mt-0.5"
                title={metrics.bankHoursAvailabilityReason}
              >
                Apenas competência integral
              </span>
            </>
          ) : metrics.bankHoursAvailability === 'error' ? (
            <>
              <span className="text-sm font-semibold text-rose-500 block mt-1">
                Indisponível
              </span>
              <span className="text-[10px] text-[var(--hc-text-muted)] block mt-0.5">
                Erro na consulta do banco
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-[var(--hc-text-secondary)] block mt-1">
                Não configurado
              </span>
              <span className="text-[10px] text-[var(--hc-text-muted)] block mt-0.5">
                Definir início e saldo
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

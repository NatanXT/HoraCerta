import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle2, Clock } from 'lucide-react';
import { DailyBalanceDistribution } from '../types';

interface DailyBalanceDistributionChartProps {
  distribution: DailyBalanceDistribution;
}

export const DailyBalanceDistributionChart: React.FC<DailyBalanceDistributionChartProps> = ({
  distribution,
}) => {
  const {
    positiveDaysCount,
    negativeDaysCount,
    balancedDaysCount,
    unaccountedDaysCount,
    unavailableDaysCount = 0,
    inProgressDaysCount,
    totalAccountedDays,
    totalCalendarDays,
  } = distribution;

  const getPercent = (count: number, base: number) => {
    if (base <= 0) return 0;
    return Math.round((count / base) * 100);
  };

  const posPct = getPercent(positiveDaysCount, totalAccountedDays);
  const negPct = getPercent(negativeDaysCount, totalAccountedDays);
  const balPct = getPercent(balancedDaysCount, totalAccountedDays);

  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[var(--hc-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--hc-text)] tracking-tight">
              Distribuição dos Saldos Diários
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Proporções
            </span>
          </div>
          <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5">
            Classificação dos dias apurados em saldos positivos, negativos, equilibrados e não aplicáveis.
          </p>
        </div>

        <span className="text-xs text-[var(--hc-text-muted)] font-mono">
          Base: {totalAccountedDays} dias apurados ({totalCalendarDays} dias civis no período
          {unavailableDaysCount > 0 && ` • ${unavailableDaysCount} ${unavailableDaysCount === 1 ? 'dia indisponível' : 'dias indisponíveis'}`})
        </span>
      </div>

      {/* Proportional Segmented Progress Bar */}
      {totalAccountedDays > 0 ? (
        <div className="space-y-1.5">
          <div className="h-4 w-full bg-[var(--hc-surface-raised)] rounded-full overflow-hidden flex border border-[var(--hc-border)]">
            {positiveDaysCount > 0 && (
              <div
                style={{ width: `${posPct}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Saldo positivo: ${positiveDaysCount} dias (${posPct}%)`}
              />
            )}
            {balancedDaysCount > 0 && (
              <div
                style={{ width: `${balPct}%` }}
                className="bg-sky-400 h-full transition-all duration-300"
                title={`Saldo equilibrado: ${balancedDaysCount} dias (${balPct}%)`}
              />
            )}
            {negativeDaysCount > 0 && (
              <div
                style={{ width: `${negPct}%` }}
                className="bg-rose-500 h-full transition-all duration-300"
                title={`Saldo negativo: ${negativeDaysCount} dias (${negPct}%)`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--hc-text-muted)] px-1">
            <span>0%</span>
            <span>50%</span>
            <span>100% da base apurada</span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] text-center text-xs text-[var(--hc-text-secondary)]">
          Nenhum dia com apuração fechada no período selecionado.
        </div>
      )}

      {/* 4 Categorized Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Positivos */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              Saldo Positivo
            </span>
            <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {posPct}%
            </span>
          </div>
          <div className="text-lg font-extrabold text-[var(--hc-text)] font-mono">
            {positiveDaysCount} {positiveDaysCount === 1 ? 'dia' : 'dias'}
          </div>
          <p className="text-[10px] text-[var(--hc-text-secondary)]">
            Horas trabalhadas acima do previsto
          </p>
        </div>

        {/* 2. Equilibrados */}
        <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Saldo Equilibrado
            </span>
            <span className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400">
              {balPct}%
            </span>
          </div>
          <div className="text-lg font-extrabold text-[var(--hc-text)] font-mono">
            {balancedDaysCount} {balancedDaysCount === 1 ? 'dia' : 'dias'}
          </div>
          <p className="text-[10px] text-[var(--hc-text-secondary)]">
            Jornada exata (saldo 00h00) ou abonado
          </p>
        </div>

        {/* 3. Negativos */}
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
              Saldo Negativo
            </span>
            <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
              {negPct}%
            </span>
          </div>
          <div className="text-lg font-extrabold text-[var(--hc-text)] font-mono">
            {negativeDaysCount} {negativeDaysCount === 1 ? 'dia' : 'dias'}
          </div>
          <p className="text-[10px] text-[var(--hc-text-secondary)]">
            Horas trabalhadas abaixo do previsto
          </p>
        </div>

        {/* 4. Sem Apuração / Não aplicável */}
        <div className="p-3.5 rounded-xl border border-[var(--hc-border)] bg-[var(--hc-surface-raised)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--hc-text-secondary)] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Sem Apuração
            </span>
            <span className="text-xs font-mono text-[var(--hc-text-muted)]">
              {getPercent(unaccountedDaysCount, totalCalendarDays)}% civil
            </span>
          </div>
          <div className="text-lg font-extrabold text-[var(--hc-text)] font-mono">
            {unaccountedDaysCount} {unaccountedDaysCount === 1 ? 'dia' : 'dias'}
          </div>
          <p className="text-[10px] text-[var(--hc-text-secondary)]">
            Folgas sem registros, datas futuras, ausências ou em andamento
          </p>
        </div>
      </div>

      {unavailableDaysCount > 0 && (
        <div className="p-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-amber-600 dark:text-amber-400">
          <span className="font-semibold">
            Dados não fornecidos pelo servidor: {unavailableDaysCount} {unavailableDaysCount === 1 ? 'dia civil ausente' : 'dias civis ausentes'}
          </span>
          <span className="text-[11px] text-[var(--hc-text-muted)]">
            Preservados na partição sem serem classificados como folga ou falta
          </span>
        </div>
      )}

      <p className="text-[11px] text-[var(--hc-text-muted)] italic">
        * Os percentuais de saldo positivo, equilibrado e negativo têm como denominador os {totalAccountedDays} dias efetivamente apurados, excluindo folgas não trabalhadas e datas futuras.
        {inProgressDaysCount > 0 && ` (Inclui ${inProgressDaysCount} dia(s) com expediente em andamento não consolidado no grupo sem apuração).`}
        {unavailableDaysCount > 0 && ` (${unavailableDaysCount} dia(s) com dados indisponíveis mantido(s) no total civil de ${totalCalendarDays} dias).`}
      </p>
    </div>
  );
};

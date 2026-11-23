import { AlertCircle, LineChart, RefreshCw } from 'lucide-react';
import { useWorkAnalytics } from '../features/work-analytics';
import { AnalyticsPeriodFilter } from '../features/work-analytics';
import { AnalyticsSummaryCards } from '../features/work-analytics';
import { BankHoursEvolutionChart } from '../features/work-analytics';
import { PlannedVsWorkedChart } from '../features/work-analytics';
import { DailyBalanceDistributionChart } from '../features/work-analytics';
import { MonthlyComparisonChart } from '../features/work-analytics';
import { AnalyticsEmptyState } from '../features/work-analytics';
import { LoadingSkeleton } from '../components/dashboard/LoadingSkeleton';
import { OfflineError } from '../components/dashboard/OfflineError';

export function AnalyticsPage() {
  const {
    preset,
    range,
    data,
    loading,
    error,
    refreshError,
    warning,
    customStartDate,
    customEndDate,
    customError,
    setCustomStartDate,
    setCustomEndDate,
    selectPreset,
    applyCustomRange,
    retry,
  } = useWorkAnalytics();

  return (
    <div className="min-h-full bg-[var(--hc-bg)] text-[var(--hc-text)] selection:bg-[var(--hc-accent)] selection:text-[var(--hc-accent-foreground)]">
      <div className="w-full space-y-5 sm:space-y-6">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[var(--hc-border)] gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[var(--hc-accent-soft)] text-[var(--hc-accent)]">
                <LineChart className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--hc-text)]">
                Análises e Tendências de Jornada
              </h1>
            </div>
            <p className="text-xs text-[var(--hc-text-secondary)] mt-1">
              Visão analítica de evolução histórica do banco de horas, horas planejadas versus realizadas e indicadores de desempenho.
            </p>
          </div>
        </div>

        {/* Period Filter */}
        <AnalyticsPeriodFilter
          preset={preset}
          range={range}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          customError={customError}
          loading={loading}
          onSelectPreset={selectPreset}
          onChangeCustomStart={setCustomStartDate}
          onChangeCustomEnd={setCustomEndDate}
          onApplyCustom={applyCustomRange}
        />

        {/* Refresh Error with Previous Data Preserved */}
        {refreshError && data && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs shadow-xs animate-fadeIn"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
              <span>{refreshError}</span>
            </div>
            <button
              type="button"
              onClick={retry}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold hover:opacity-90 active:opacity-95 transition-opacity cursor-pointer text-xs shrink-0 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {/* Non-blocking Partial Data / Month Warning Banner */}
        {warning && (
          <div
            role="status"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs shadow-xs animate-fadeIn"
          >
            <AlertCircle size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
            <span>{warning}</span>
          </div>
        )}

        {/* Loading State when no data */}
        {loading && !data && <LoadingSkeleton />}

        {/* Offline Error when no data */}
        {error && !data && <OfflineError message={error} onRetry={retry} />}

        {/* Empty State */}
        {data && data.filteredDays.length === 0 && (
          <AnalyticsEmptyState onResetPreset={() => selectPreset('current-month')} />
        )}

        {/* Ready Data Content */}
        {data && data.filteredDays.length > 0 && (
          <div className="space-y-5 sm:space-y-6 animate-fadeIn">
            {/* 1. Summary Indicator Cards */}
            <AnalyticsSummaryCards metrics={data.summaryMetrics} />

            {/* 2. Gráfico A: Evolução do Banco de Horas */}
            <BankHoursEvolutionChart
              evolution={data.bankHoursEvolution}
              isBankHoursConfigured={data.isBankHoursConfigured}
              bankHoursStatus={data.bankHoursStatus}
              configStartDate={data.bankHoursConfigStartDate}
              onRetry={retry}
            />

            {/* 3. Gráfico B: Horas Previstas vs. Horas Trabalhadas */}
            <PlannedVsWorkedChart aggregations={data.monthlyAggregations} />

            {/* 4. Gráfico C: Distribuição dos Saldos Diários */}
            <DailyBalanceDistributionChart distribution={data.dailyBalanceDistribution} />

            {/* 5. Gráfico D: Comparativo Mensal Consolidado */}
            <MonthlyComparisonChart aggregations={data.monthlyAggregations} />
          </div>
        )}
      </div>
    </div>
  );
}

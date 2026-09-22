import { Settings } from 'lucide-react';
import { useBankHours } from '../hooks/useBankHours';
import { BankHoursConfigForm } from '../components/bank-hours/BankHoursConfigForm';
import { BankHoursSummaryCards } from '../components/bank-hours/BankHoursSummaryCards';
import { BankHoursSecondaryStats } from '../components/bank-hours/BankHoursSecondaryStats';
import { BankHoursMonthlyList } from '../components/bank-hours/BankHoursMonthlyList';
import { BankHoursPendingList } from '../components/bank-hours/BankHoursPendingList';
import { FeedbackBanner } from '../components/dashboard/FeedbackBanner';
import { LoadingSkeleton } from '../components/dashboard/LoadingSkeleton';
import { OfflineError } from '../components/dashboard/OfflineError';
import { formatBalance } from '../utils/time';
import { formatFullDate } from '../utils/date';

export function BankHoursPage() {
  const {
    data,
    loading,
    saving,
    error,
    feedback,
    isEditingConfig,
    todayStr,
    saveConfig,
    toggleEditConfig,
    retry,
  } = useBankHours();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <FeedbackBanner feedback={feedback} />

        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800/80 gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Banco de Horas</h1>
            <p className="text-xs text-slate-400">Apuração acumulada e acompanhamento do saldo de horas.</p>
          </div>

          {data?.configured && !isEditingConfig && (
            <button
              type="button"
              onClick={toggleEditConfig}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-900 text-slate-300 border border-slate-800 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>Editar configuração</span>
            </button>
          )}
        </div>

        {loading && !data && <LoadingSkeleton />}

        {error && !data && (
          <OfflineError message={error} onRetry={retry} />
        )}

        {data && (
          <>
            {/* Show configuration form if not configured or when editing */}
            {(!data.configured || isEditingConfig) && (
              <BankHoursConfigForm
                initialStartDate={data.config?.startDate || data.suggestedStartDate || todayStr}
                initialBalanceMinutes={data.config?.initialBalanceMinutes ?? 0}
                todayStr={todayStr}
                saving={saving}
                onSave={saveConfig}
                onCancel={data.configured ? toggleEditConfig : undefined}
                isEditingExistingConfig={data.configured}
              />
            )}

            {/* Show active bank status dashboard when configured and not editing */}
            {data.configured && !isEditingConfig && data.summary && (
              <div className="space-y-6 sm:space-y-8">
                {/* Active Configuration Summary Badge */}
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
                  <div className="flex items-center gap-3">
                    <span>Início da apuração: <strong className="text-slate-200 font-mono">{formatFullDate(data.config!.startDate)}</strong></span>
                    <span className="hidden sm:inline">•</span>
                    <span>Saldo inicial: <strong className="text-slate-200 font-mono">{formatBalance(data.config!.initialBalanceMinutes)}</strong></span>
                  </div>
                  <span className="text-slate-500 italic">Datas anteriores a esta são ignoradas no banco.</span>
                </div>

                {/* 3 Main Summary Cards */}
                <BankHoursSummaryCards summary={data.summary} />

                {/* 4 Secondary Statistics Cards */}
                <BankHoursSecondaryStats summary={data.summary} />

                {/* Monthly Breakdown List */}
                <BankHoursMonthlyList monthly={data.monthly} />

                {/* Pending Days List */}
                <BankHoursPendingList pending={data.pending} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

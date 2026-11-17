import { useMonthlyHistory } from '../hooks/useMonthlyHistory';
import { MonthSelector } from '../components/history/MonthSelector';
import { MonthlySummaryCards } from '../components/history/MonthlySummaryCards';
import { MonthlyCalendar } from '../components/history/MonthlyCalendar';
import { DayDetails } from '../components/history/DayDetails';
import { LoadingSkeleton } from '../components/dashboard/LoadingSkeleton';
import { OfflineError } from '../components/dashboard/OfflineError';
import { AlertCircle } from 'lucide-react';

export function HistoryPage() {
  const {
    selectedMonth,
    data,
    selectedDayDate,
    selectedDay,
    loading,
    error,
    holidayWarning,
    isCurrentMonthSelected,
    goToPreviousMonth,
    goToNextMonth,
    selectDay,
    refresh,
    retry,
  } = useMonthlyHistory();

  return (
    <div className="min-h-full bg-[var(--hc-bg)] text-[var(--hc-text)] selection:bg-[var(--hc-accent)] selection:text-[var(--hc-accent-foreground)]">
      <div className="w-full space-y-5 sm:space-y-6">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[var(--hc-border)] gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--hc-text)]">Histórico Mensal</h1>
            <p className="text-xs text-[var(--hc-text-secondary)]">Visão detalhada da sua frequência, horas e registros do mês.</p>
          </div>
        </div>

        {/* Month Selector Controls */}
        <MonthSelector
          selectedMonth={selectedMonth}
          isCurrentMonthSelected={isCurrentMonthSelected}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />

        {holidayWarning && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs shadow-sm">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <span>{holidayWarning}</span>
          </div>
        )}

        {loading && !data && <LoadingSkeleton />}

        {error && !data && (
          <OfflineError message={error} onRetry={retry} />
        )}

        {data && (
          <div className="space-y-5 sm:space-y-6">
            {/* Descriptive Monthly Summary Cards */}
            <MonthlySummaryCards summary={data.summary} />

            {/* Real Monthly Calendar Grid */}
            <MonthlyCalendar
              days={data.days}
              selectedDayDate={selectedDayDate}
              onSelectDay={selectDay}
            />

            {/* Selected Day Details Panel */}
            <DayDetails day={selectedDay} onDayUpdated={refresh} />
          </div>
        )}
      </div>
    </div>
  );
}

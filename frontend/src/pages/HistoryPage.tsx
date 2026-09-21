import { useMonthlyHistory } from '../hooks/useMonthlyHistory';
import { MonthSelector } from '../components/history/MonthSelector';
import { MonthlySummaryCards } from '../components/history/MonthlySummaryCards';
import { MonthlyCalendar } from '../components/history/MonthlyCalendar';
import { DayDetails } from '../components/history/DayDetails';
import { LoadingSkeleton } from '../components/dashboard/LoadingSkeleton';
import { OfflineError } from '../components/dashboard/OfflineError';

export function HistoryPage() {
  const {
    selectedMonth,
    data,
    selectedDayDate,
    selectedDay,
    loading,
    error,
    isCurrentMonthSelected,
    goToPreviousMonth,
    goToNextMonth,
    selectDay,
    retry,
  } = useMonthlyHistory();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800/80 gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Histórico Mensal</h1>
            <p className="text-xs text-slate-400">Visão detalhada da sua frequência, horas e registros do mês.</p>
          </div>
        </div>

        {/* Month Selector Controls */}
        <MonthSelector
          selectedMonth={selectedMonth}
          isCurrentMonthSelected={isCurrentMonthSelected}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />

        {loading && !data && <LoadingSkeleton />}

        {error && !data && (
          <OfflineError message={error} onRetry={retry} />
        )}

        {data && (
          <div className="space-y-6 sm:space-y-8">
            {/* Descriptive Monthly Summary Cards */}
            <MonthlySummaryCards summary={data.summary} />

            {/* Real Monthly Calendar Grid */}
            <MonthlyCalendar
              days={data.days}
              selectedDayDate={selectedDayDate}
              onSelectDay={selectDay}
            />

            {/* Selected Day Details Panel */}
            <DayDetails day={selectedDay} />
          </div>
        )}
      </div>
    </main>
  );
}

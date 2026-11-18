import { useSmartCalendar } from '../features/smart-calendar/useSmartCalendar';
import { SmartCalendarMonthSelector } from '../features/smart-calendar/SmartCalendarMonthSelector';
import { SmartCalendarGrid } from '../features/smart-calendar/SmartCalendarGrid';
import { SmartCalendarListView } from '../features/smart-calendar/SmartCalendarListView';
import { SmartCalendarDayDetail } from '../features/smart-calendar/SmartCalendarDayDetail';
import { MonthlySummaryCards } from '../components/history/MonthlySummaryCards';
import { LoadingSkeleton } from '../components/dashboard/LoadingSkeleton';
import { OfflineError } from '../components/dashboard/OfflineError';
import { AlertCircle } from 'lucide-react';

export function HistoryPage() {
  const {
    selectedMonth,
    data,
    gridData,
    selectedDayDate,
    selectedDay,
    viewMode,
    loading,
    error,
    holidayWarning,
    isCurrentMonthSelected,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    selectDay,
    setViewMode,
    refresh,
    retry,
  } = useSmartCalendar();

  return (
    <div className="min-h-full bg-[var(--hc-bg)] text-[var(--hc-text)] selection:bg-[var(--hc-accent)] selection:text-[var(--hc-accent-foreground)]">
      <div className="w-full space-y-5 sm:space-y-6">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[var(--hc-border)] gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--hc-text)]">
              Calendário Inteligente de Jornada
            </h1>
            <p className="text-xs text-[var(--hc-text-secondary)]">
              Visão mensal interativa de registros, saldos diários, folgas, feriados e ausências.
            </p>
          </div>
        </div>

        {/* Month Selector Controls & View Mode Switcher */}
        <SmartCalendarMonthSelector
          selectedMonth={selectedMonth}
          isCurrentMonthSelected={isCurrentMonthSelected}
          viewMode={viewMode}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onToday={goToToday}
          onViewModeChange={setViewMode}
        />

        {holidayWarning && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs shadow-xs">
            <AlertCircle size={16} className="text-amber-500 shrink-0" />
            <span>{holidayWarning}</span>
          </div>
        )}

        {loading && !data && <LoadingSkeleton />}

        {error && !data && (
          <OfflineError message={error} onRetry={retry} />
        )}

        {data && gridData && (
          <div className="space-y-5 sm:space-y-6">
            {/* Descriptive Monthly Summary Cards */}
            <MonthlySummaryCards summary={data.summary} />

            {/* Smart Monthly View (Calendar or List) */}
            {viewMode === 'calendar' ? (
              <SmartCalendarGrid
                gridData={gridData}
                selectedDayDate={selectedDayDate}
                onSelectDay={selectDay}
              />
            ) : (
              <SmartCalendarListView
                gridData={gridData}
                selectedDayDate={selectedDayDate}
                onSelectDay={selectDay}
              />
            )}

            {/* Selected Day Details Panel */}
            <SmartCalendarDayDetail day={selectedDay} onDayUpdated={refresh} />
          </div>
        )}
      </div>
    </div>
  );
}

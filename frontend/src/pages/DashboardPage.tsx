import { useTodayWorkDay } from '../hooks/useTodayWorkDay';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { ClockCard } from '../components/dashboard/ClockCard';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { TodayEntries } from '../components/dashboard/TodayEntries';
import { FeedbackBanner } from '../components/dashboard/FeedbackBanner';
import { LoadingSkeleton } from '../components/dashboard/LoadingSkeleton';
import { OfflineError } from '../components/dashboard/OfflineError';

export function DashboardPage() {
  const {
    data,
    loading,
    submitting,
    error,
    feedback,
    fetchToday,
    handleStart,
    handlePauseSnack,
    handlePauseLunch,
    handleResume,
    handleFinish,
    handleReconcile,
  } = useTodayWorkDay();

  return (
    <div className="min-h-full bg-[var(--hc-bg)] text-[var(--hc-text)] selection:bg-[var(--hc-accent)] selection:text-[var(--hc-accent-foreground)]">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <FeedbackBanner feedback={feedback} />

        <DashboardHeader />

        {loading && !data && <LoadingSkeleton />}

        {error && !data && (
          <OfflineError message={error} onRetry={fetchToday} />
        )}

        {data && (
          <div className="space-y-6 sm:space-y-8">
            <ClockCard
              summary={data}
              submitting={submitting}
              onStart={handleStart}
              onPauseSnack={handlePauseSnack}
              onPauseLunch={handlePauseLunch}
              onResume={handleResume}
              onFinish={handleFinish}
              onReconcile={handleReconcile}
            />

            <SummaryCard summary={data as any} />

            <TodayEntries entries={data.entries} />
          </div>
        )}
      </div>
    </div>
  );
}

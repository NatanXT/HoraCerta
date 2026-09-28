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
  } = useTodayWorkDay();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
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
            />

            <SummaryCard summary={data as any} />

            <TodayEntries entries={data.entries} />
          </div>
        )}
      </div>
    </main>
  );
}

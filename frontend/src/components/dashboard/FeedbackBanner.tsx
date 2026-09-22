import { CircleCheck, TriangleAlert } from 'lucide-react';
import { FeedbackState } from '../../hooks/useTodayWorkDay';

interface FeedbackBannerProps {
  feedback: FeedbackState | null;
}

export function FeedbackBanner({ feedback }: FeedbackBannerProps) {
  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`p-4 rounded-xl text-sm font-medium border shadow-lg transition-all duration-300 flex items-start justify-between gap-3 ${
        isSuccess
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
          : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {isSuccess ? (
          <CircleCheck className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
        ) : (
          <TriangleAlert className="w-4 h-4 shrink-0 text-rose-400" aria-hidden="true" />
        )}
        <span>{feedback.message}</span>
      </div>
    </div>
  );
}

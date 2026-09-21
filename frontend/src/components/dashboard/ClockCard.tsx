import { useState, useEffect } from 'react';
import { WorkDaySummary } from '../../types/work-day';
import { formatClockTime } from '../../utils/date';

interface ClockCardProps {
  summary: WorkDaySummary;
  submitting: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
}

export function ClockCard({ summary, submitting, onClockIn, onClockOut }: ClockCardProps) {
  const [clockTime, setClockTime] = useState<string>('');

  useEffect(() => {
    setClockTime(formatClockTime());
    const interval = setInterval(() => {
      setClockTime(formatClockTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    if (submitting) return;
    if (summary.nextAction === 'CLOCK_IN') {
      onClockIn();
    } else {
      onClockOut();
    }
  };

  const isClockIn = summary.nextAction === 'CLOCK_IN';

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
      {/* Background glow gradient */}
      <div
        className={`absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-500 ${
          summary.isOpen ? 'bg-emerald-500' : 'bg-indigo-500'
        }`}
      />

      {/* Status Badge */}
      <div className="flex justify-center">
        {summary.isOpen ? (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Expediente em andamento
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/50">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Fora do expediente
          </span>
        )}
      </div>

      {/* Digital Clock Display */}
      <div className="py-2">
        <div className="text-4xl sm:text-5xl font-mono font-extrabold tracking-tight text-white drop-shadow-sm select-none">
          {clockTime || '00:00:00'}
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2 max-w-xs mx-auto">
        <button
          type="button"
          onClick={handleClick}
          disabled={submitting}
          aria-label={submitting ? 'Registrando...' : isClockIn ? 'Registrar entrada' : 'Registrar saída'}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base transition-all duration-200 shadow-lg flex items-center justify-center gap-2 ${
            submitting
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50 shadow-none'
              : isClockIn
              ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-900/30 hover:shadow-emerald-900/50 cursor-pointer'
              : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-amber-900/30 hover:shadow-amber-900/50 cursor-pointer'
          }`}
        >
          {submitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Registrando...
            </>
          ) : isClockIn ? (
            'Registrar entrada'
          ) : (
            'Registrar saída'
          )}
        </button>
      </div>
    </div>
  );
}

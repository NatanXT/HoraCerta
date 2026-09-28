import React, { useState, useEffect } from 'react';
import { Play, Coffee, Utensils, LogOut, Clock } from 'lucide-react';
import { WorkDayWithSession, WorkSessionState } from '../../services/work-session.service';
import { formatClockTime } from '../../utils/date';

interface ClockCardProps {
  summary: WorkDayWithSession;
  submitting: boolean;
  onStart: () => void;
  onPauseSnack: () => void;
  onPauseLunch: () => void;
  onResume: () => void;
  onFinish: () => void;
}

function formatElapsedTimer(startedAtIso: string): string {
  if (!startedAtIso) return '00:00:00';
  const startMs = new Date(startedAtIso).getTime();
  const nowMs = new Date().getTime();
  const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));

  const h = Math.floor(diffSecs / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  const s = diffSecs % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinutesToHhMm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const ClockCard: React.FC<ClockCardProps> = ({
  summary,
  submitting,
  onStart,
  onPauseSnack,
  onPauseLunch,
  onResume,
  onFinish,
}) => {
  const [clockTime, setClockTime] = useState<string>('');
  const [breakTimer, setBreakTimer] = useState<string>('00:00:00');

  const session = summary.session;
  const hasEntries = summary.entries && summary.entries.length > 0;
  const activeBreakFromList = summary.workBreaks?.find((b) => !b.endedAt && !(b as any).deletedAt);
  const state: WorkSessionState =
    session?.state ||
    (activeBreakFromList
      ? activeBreakFromList.type === 'SNACK'
        ? 'ON_SNACK_BREAK'
        : 'ON_LUNCH_BREAK'
      : summary.isOpen
      ? 'WORKING'
      : hasEntries
      ? 'ENDED'
      : 'NOT_STARTED');

  const activeBreak =
    session?.activeBreak ||
    (activeBreakFromList
      ? {
          id: activeBreakFromList.id,
          type: activeBreakFromList.type as 'SNACK' | 'LUNCH',
          startedAt:
            typeof activeBreakFromList.startedAt === 'string'
              ? activeBreakFromList.startedAt
              : new Date(activeBreakFromList.startedAt).toISOString(),
          elapsedMinutes: activeBreakFromList.durationMinutes || 0,
        }
      : null);

  const breakSummary = summary.breakSummary;

  // Real-time clock & break timer tick
  useEffect(() => {
    setClockTime(formatClockTime());

    if (activeBreak?.startedAt) {
      setBreakTimer(formatElapsedTimer(activeBreak.startedAt));
    }

    const interval = setInterval(() => {
      setClockTime(formatClockTime());
      if (activeBreak?.startedAt) {
        setBreakTimer(formatElapsedTimer(activeBreak.startedAt));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBreak?.startedAt]);

  const showSnackBtn = breakSummary ? breakSummary.plannedSnackMinutes > 0 : true;
  const showLunchBtn = breakSummary ? breakSummary.plannedLunchMinutes > 0 : true;

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
      {/* Background glow gradient */}
      <div
        className={`absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-500 ${
          state === 'WORKING'
            ? 'bg-emerald-500'
            : state === 'ON_SNACK_BREAK' || state === 'ON_LUNCH_BREAK'
            ? 'bg-amber-500'
            : 'bg-indigo-500'
        }`}
      />

      {/* Status Badge */}
      <div className="flex flex-col items-center gap-2">
        {state === 'NOT_STARTED' && (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Pronto para iniciar
          </span>
        )}

        {state === 'WORKING' && (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Expediente em andamento
          </span>
        )}

        {state === 'ON_SNACK_BREAK' && (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Pausa para lanche
          </span>
        )}

        {state === 'ON_LUNCH_BREAK' && (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Pausa para almoço
          </span>
        )}

        {state === 'ENDED' && (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/50">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Expediente encerrado
          </span>
        )}
      </div>

      {/* Digital Clock Display */}
      <div className="py-2">
        <div className="text-4xl sm:text-5xl font-mono font-extrabold tracking-tight text-white drop-shadow-sm select-none">
          {clockTime || '00:00:00'}
        </div>
      </div>

      {/* Active Break Timer Section */}
      {(state === 'ON_SNACK_BREAK' || state === 'ON_LUNCH_BREAK') && activeBreak && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 max-w-sm mx-auto space-y-2">
          <div className="text-xs text-amber-300 font-medium flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Tempo em pausa:</span>
            <span className="font-mono text-base font-bold text-amber-200">{breakTimer}</span>
          </div>
          {breakSummary && (
            <div className="text-[11px] text-amber-400/80">
              Previsto:{' '}
              <span className="font-medium text-amber-300">
                {state === 'ON_SNACK_BREAK'
                  ? formatMinutesToHhMm(breakSummary.plannedSnackMinutes)
                  : formatMinutesToHhMm(breakSummary.plannedLunchMinutes)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Container */}
      <div className="pt-2 max-w-md mx-auto">
        {state === 'NOT_STARTED' && (
          <button
            type="button"
            onClick={onStart}
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
            <span>{submitting ? 'Iniciando...' : 'Iniciar expediente'}</span>
          </button>
        )}

        {state === 'WORKING' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {showSnackBtn && (
              <button
                type="button"
                onClick={onPauseSnack}
                disabled={submitting}
                className="py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-amber-600/20 hover:bg-amber-600/30 active:bg-amber-600/40 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Coffee className="w-4 h-4 text-amber-400" />
                <span>Pausa lanche</span>
              </button>
            )}

            {showLunchBtn && (
              <button
                type="button"
                onClick={onPauseLunch}
                disabled={submitting}
                className="py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-amber-600/20 hover:bg-amber-600/30 active:bg-amber-600/40 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Utensils className="w-4 h-4 text-amber-400" />
                <span>Pausa almoço</span>
              </button>
            )}

            <button
              type="button"
              onClick={onFinish}
              disabled={submitting}
              className={`py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                !showSnackBtn && !showLunchBtn ? 'sm:col-span-3' : ''
              }`}
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>Registrar saída</span>
            </button>
          </div>
        )}

        {(state === 'ON_SNACK_BREAK' || state === 'ON_LUNCH_BREAK') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onResume}
              disabled={submitting}
              className="py-3.5 px-6 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              <span>{submitting ? 'Retomando...' : 'Retomar expediente'}</span>
            </button>

            <button
              type="button"
              onClick={onFinish}
              disabled={submitting}
              className="py-3.5 px-6 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span>Registrar saída</span>
            </button>
          </div>
        )}

        {state === 'ENDED' && (
          <button
            type="button"
            onClick={onStart}
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-5 h-5 text-indigo-400" />
            <span>Iniciar novo período</span>
          </button>
        )}
      </div>
    </div>
  );
};

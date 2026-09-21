import { useState, useEffect } from 'react';
import { formatCurrentDate } from '../../utils/date';

export function DashboardHeader() {
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    setCurrentDateStr(formatCurrentDate());

    // Update date string every minute to handle day transitions if app remains open
    const interval = setInterval(() => {
      setCurrentDateStr(formatCurrentDate());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800 gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-extrabold flex items-center justify-center text-lg shadow-inner">
          HC
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">HoraCerta</h1>
          <p className="text-xs text-slate-400">Controle simples da sua jornada.</p>
        </div>
      </div>

      {currentDateStr && (
        <div className="text-sm font-medium text-slate-300 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800/80 shadow-sm flex items-center gap-2 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          {currentDateStr}
        </div>
      )}
    </header>
  );
}

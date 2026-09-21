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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800/80 gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Painel do Dia</h1>
        <p className="text-xs text-slate-400">Acompanhamento e registro da sua jornada de hoje.</p>
      </div>

      {currentDateStr && (
        <div className="text-xs font-semibold text-slate-300 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-sm flex items-center gap-2 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {currentDateStr}
        </div>
      )}
    </div>
  );
}

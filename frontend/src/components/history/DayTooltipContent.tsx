import React from 'react';
import { MonthlyDaySummary } from '../../types/work-day';
import { formatMinutes, formatBalance } from '../../utils/time';
import { CalendarDays, AlertCircle, Clock, History } from 'lucide-react';

interface DayTooltipContentProps {
  day: MonthlyDaySummary;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  RECORDED: { label: 'Registrado', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' },
  EXCUSED: { label: 'Abonado', color: 'text-indigo-300 bg-indigo-950/40 border-indigo-500/30' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' },
  INCOMPLETE: { label: 'Incompleto', color: 'text-amber-400 bg-amber-950/40 border-amber-500/30' },
  NO_RECORDS: { label: 'Sem registro', color: 'text-slate-400 bg-slate-800/40 border-slate-700/40' },
  REST_DAY: { label: 'Folga', color: 'text-slate-400 bg-slate-900/40 border-slate-800/40' },
  FUTURE: { label: 'Futuro', color: 'text-slate-500 bg-slate-950/40 border-slate-800/30' },
};

function formatCivilDateToLongPtBr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekdayNames = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  const weekdayName = weekdayNames[date.getUTCDay()];
  const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  return `${weekdayName}, ${formattedDate}`;
}

export const DayTooltipContent: React.FC<DayTooltipContentProps> = ({ day }) => {
  const dateHeading = formatCivilDateToLongPtBr(day.date);
  const statusConfig = STATUS_LABELS[day.status] || {
    label: day.status,
    color: 'text-slate-300 bg-slate-800/40 border-slate-700/40',
  };

  const hasBaseShift =
    day.baseExpectedMinutes !== undefined &&
    day.baseExpectedMinutes !== null &&
    day.baseExpectedMinutes !== day.expectedMinutes;

  const entriesCount = day.entries ? day.entries.length : 0;
  const isWorkedOrRecorded = day.totalWorkedMinutes > 0 || day.status === 'RECORDED';

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 text-slate-100 rounded-xl shadow-2xl p-3 w-64 sm:w-72 text-xs backdrop-blur-md space-y-2.5">
      {/* Date Header */}
      <div className="border-b border-slate-800/80 pb-2">
        <h4 className="font-bold text-white tracking-tight text-xs sm:text-[13px]">
          {dateHeading}
        </h4>
      </div>

      {/* Holiday Notification Pill */}
      {day.holiday && (
        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-indigo-950/50 border border-indigo-500/40 text-indigo-200">
          <CalendarDays size={14} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="leading-tight">
            <span className="font-semibold text-[10px] uppercase tracking-wider text-indigo-400 block">
              Feriado Nacional
            </span>
            <span className="font-medium text-xs text-indigo-100">
              {day.holiday.name}
            </span>
          </div>
        </div>
      )}

      {/* Calendar Occurrence Pill */}
      {day.occurrence && (
        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-200">
          <AlertCircle size={14} className="text-purple-400 shrink-0 mt-0.5" />
          <div className="leading-tight">
            <span className="font-semibold text-[10px] uppercase tracking-wider text-purple-400 block">
              Ocorrência
            </span>
            <span className="font-medium text-xs text-purple-100">
              {day.occurrence.title}
            </span>
          </div>
        </div>
      )}

      {/* Grid of Key Info */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 py-1">
        {/* Status */}
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Status</span>
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold border ${statusConfig.color}`}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Expected Time */}
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">
            {hasBaseShift ? 'Jornada efetiva' : 'Jornada prevista'}
          </span>
          <span className="font-mono font-semibold text-slate-200">
            {formatMinutes(day.expectedMinutes)}
          </span>
          {hasBaseShift && (
            <span className="text-[10px] text-slate-400 block font-mono">
              (Base: {formatMinutes(day.baseExpectedMinutes!)})
            </span>
          )}
        </div>

        {/* Worked Time */}
        {isWorkedOrRecorded && (
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Trabalhado</span>
            <span className="font-mono font-bold text-white">
              {formatMinutes(day.totalWorkedMinutes)}
            </span>
          </div>
        )}

        {/* Balance */}
        {day.balanceMinutes !== null && (
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Saldo</span>
            <span
              className={`font-mono font-bold ${
                day.balanceMinutes > 0
                  ? 'text-emerald-400'
                  : day.balanceMinutes < 0
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {formatBalance(day.balanceMinutes)}
            </span>
          </div>
        )}

        {/* Bank Hours Impact */}
        {day.bankHoursImpactMinutes !== null && day.bankHoursImpactMinutes !== undefined && (
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Impacto BH</span>
            <span
              className={`font-mono font-semibold ${
                day.bankHoursImpactMinutes > 0
                  ? 'text-emerald-400'
                  : day.bankHoursImpactMinutes < 0
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {formatBalance(day.bankHoursImpactMinutes)}
            </span>
          </div>
        )}

        {/* Entries Count */}
        {entriesCount > 0 && (
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Registros</span>
            <span className="font-medium text-slate-300">
              {entriesCount} {entriesCount === 1 ? 'batida' : 'batidas'}
            </span>
          </div>
        )}
      </div>

      {/* Badges / Extras */}
      {(day.hasManualAdjustments || day.isOpen) && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/60">
          {day.hasManualAdjustments && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300">
              <History size={10} />
              Ajustado manualmente
            </span>
          )}
          {day.isOpen && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 animate-pulse">
              <Clock size={10} />
              Sessão em andamento
            </span>
          )}
        </div>
      )}
    </div>
  );
};

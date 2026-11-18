import React from 'react';
import { MonthlyDaySummary } from '../../types/work-day';
import { formatHolidayTypeLabel } from '../../types/holiday';
import { formatMinutes, formatBalance } from '../../utils/time';
import { CalendarDays, AlertCircle, Clock, History } from 'lucide-react';

interface DayTooltipContentProps {
  day: MonthlyDaySummary;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  RECORDED: { label: 'Registrado', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  EXCUSED: { label: 'Abonado', color: 'text-[var(--hc-accent-soft-foreground)] bg-[var(--hc-accent-soft)] border-[var(--hc-accent-border)]' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  INCOMPLETE: { label: 'Incompleto', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' },
  NO_RECORDS: { label: 'Sem registro', color: 'text-[var(--hc-text-muted)] bg-[var(--hc-surface-raised)] border-[var(--hc-border)]' },
  REST_DAY: { label: 'Folga', color: 'text-[var(--hc-text-muted)] bg-[var(--hc-surface-raised)] border-[var(--hc-border)]' },
  FUTURE: { label: 'Futuro', color: 'text-[var(--hc-text-muted)] bg-[var(--hc-surface-raised)] border-[var(--hc-border)]' },
  DATA_UNAVAILABLE: { label: 'Dados indisponíveis', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
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

  if (day.status === 'DATA_UNAVAILABLE') {
    return (
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] rounded-xl shadow-2xl p-3 w-64 sm:w-72 text-xs backdrop-blur-md space-y-2.5">
        {/* Date Header */}
        <div className="border-b border-[var(--hc-border)] pb-2">
          <h4 className="font-bold text-[var(--hc-text)] tracking-tight text-xs sm:text-[13px]">
            {dateHeading}
          </h4>
        </div>

        {/* Unavailable notice */}
        <div className="space-y-1.5 py-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold border text-amber-500 bg-amber-500/10 border-amber-500/30">
              Dados indisponíveis
            </span>
          </div>
          <p className="text-[11px] text-[var(--hc-text-secondary)] leading-relaxed">
            Os registros e jornada deste dia não foram fornecidos pelo servidor.
          </p>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_LABELS[day.status] || {
    label: day.status,
    color: 'text-[var(--hc-text-secondary)] bg-[var(--hc-surface-raised)] border-[var(--hc-border)]',
  };

  const hasBaseShift =
    day.baseExpectedMinutes !== undefined &&
    day.baseExpectedMinutes !== null &&
    day.baseExpectedMinutes !== day.expectedMinutes;

  const entriesCount = day.entries ? day.entries.length : 0;
  const isWorkedOrRecorded = day.totalWorkedMinutes > 0 || day.status === 'RECORDED';

  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] rounded-xl shadow-2xl p-3 w-64 sm:w-72 text-xs backdrop-blur-md space-y-2.5">
      {/* Date Header */}
      <div className="border-b border-[var(--hc-border)] pb-2">
        <h4 className="font-bold text-[var(--hc-text)] tracking-tight text-xs sm:text-[13px]">
          {dateHeading}
        </h4>
      </div>

      {/* Holiday Notification Pill */}
      {day.holiday && (
        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] text-[var(--hc-accent-soft-foreground)]">
          <CalendarDays size={14} className="text-[var(--hc-accent)] shrink-0 mt-0.5" />
          <div className="leading-tight">
            <span className="font-semibold text-[10px] uppercase tracking-wider text-[var(--hc-accent)] block">
              {formatHolidayTypeLabel(day.holiday.type)}
            </span>
            <span className="font-medium text-xs">
              {day.holiday.name}
            </span>
          </div>
        </div>
      )}

      {/* Calendar Occurrence Pill */}
      {day.occurrence && (
        <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-300">
          <AlertCircle size={14} className="text-purple-500 shrink-0 mt-0.5" />
          <div className="leading-tight">
            <span className="font-semibold text-[10px] uppercase tracking-wider text-purple-500 block">
              Ocorrência
            </span>
            <span className="font-medium text-xs">
              {day.occurrence.title}
            </span>
          </div>
        </div>
      )}

      {/* Grid of Key Info */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 py-1">
        {/* Status */}
        <div>
          <span className="text-[10px] text-[var(--hc-text-secondary)] block font-medium">Status</span>
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold border ${statusConfig.color}`}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Expected Time */}
        <div>
          <span className="text-[10px] text-[var(--hc-text-secondary)] block font-medium">
            {hasBaseShift ? 'Jornada efetiva' : 'Jornada prevista'}
          </span>
          <span className="font-mono font-semibold text-[var(--hc-text)]">
            {formatMinutes(day.expectedMinutes)}
          </span>
          {hasBaseShift && (
            <span className="text-[10px] text-[var(--hc-text-muted)] block font-mono">
              (Base: {formatMinutes(day.baseExpectedMinutes!)})
            </span>
          )}
        </div>

        {/* Worked Time */}
        {isWorkedOrRecorded && (
          <div>
            <span className="text-[10px] text-[var(--hc-text-secondary)] block font-medium">Trabalhado</span>
            <span className="font-mono font-bold text-[var(--hc-text)]">
              {formatMinutes(day.totalWorkedMinutes)}
            </span>
          </div>
        )}

        {/* Balance */}
        {day.balanceMinutes !== null && (
          <div>
            <span className="text-[10px] text-[var(--hc-text-secondary)] block font-medium">Saldo</span>
            <span
              className={`font-mono font-bold ${
                day.balanceMinutes > 0
                  ? 'text-emerald-500'
                  : day.balanceMinutes < 0
                  ? 'text-amber-500'
                  : 'text-[var(--hc-text-muted)]'
              }`}
            >
              {formatBalance(day.balanceMinutes)}
            </span>
          </div>
        )}

        {/* Bank Hours Impact */}
        {day.bankHoursImpactMinutes !== null && day.bankHoursImpactMinutes !== undefined && (
          <div>
            <span className="text-[10px] text-[var(--hc-text-secondary)] block font-medium">Impacto BH</span>
            <span
              className={`font-mono font-semibold ${
                day.bankHoursImpactMinutes > 0
                  ? 'text-emerald-500'
                  : day.bankHoursImpactMinutes < 0
                  ? 'text-amber-500'
                  : 'text-[var(--hc-text-muted)]'
              }`}
            >
              {formatBalance(day.bankHoursImpactMinutes)}
            </span>
          </div>
        )}

        {/* Entries Count */}
        {entriesCount > 0 && (
          <div>
            <span className="text-[10px] text-[var(--hc-text-secondary)] block font-medium">Registros</span>
            <span className="font-medium text-[var(--hc-text)]">
              {entriesCount} {entriesCount === 1 ? 'batida' : 'batidas'}
            </span>
          </div>
        )}
      </div>

      {/* Badges / Extras */}
      {(day.hasManualAdjustments || day.isOpen) && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--hc-border)]">
          {day.hasManualAdjustments && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <History size={10} />
              Ajustado manualmente
            </span>
          )}
          {day.isOpen && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-pulse">
              <Clock size={10} />
              Sessão em andamento
            </span>
          )}
        </div>
      )}
    </div>
  );
};

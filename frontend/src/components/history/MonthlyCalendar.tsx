import { MonthlyDaySummary } from '../../types/work-day';
import { formatMinutes, formatBalance } from '../../utils/time';
import { getTodayDateStr } from '../../utils/date';
import { AppTooltip } from '../ui/AppTooltip';
import { DayTooltipContent } from './DayTooltipContent';
import { CalendarDays } from 'lucide-react';

interface MonthlyCalendarProps {
  days: MonthlyDaySummary[];
  selectedDayDate: string | null;
  onSelectDay: (dateStr: string) => void;
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function MonthlyCalendar({
  days,
  selectedDayDate,
  onSelectDay,
}: MonthlyCalendarProps) {
  const todayStr = getTodayDateStr();

  // Determine empty lead-in slots before day 1 (week starting on Monday)
  let leadInSlots = 0;
  if (days.length > 0) {
    const firstDateStr = days[0].date;
    const [y, m, d] = firstDateStr.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    leadInSlots = (dayOfWeek + 6) % 7;
  }

  return (
    <section aria-label="Calendário mensal" className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-3 sm:p-5 shadow-xl backdrop-blur-sm space-y-3.5">
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 text-center border-b border-[var(--hc-border)] pb-2.5">
        {WEEKDAY_HEADERS.map((header) => (
          <span
            key={header}
            className="text-xs font-bold uppercase tracking-wider text-[var(--hc-text-secondary)]"
          >
            {header}
          </span>
        ))}
      </div>

      {/* Grid of Day Cells */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {/* Lead-in Empty Cells */}
        {Array.from({ length: leadInSlots }).map((_, i) => (
          <div key={`lead-${i}`} className="h-15 sm:h-[4.25rem] rounded-xl bg-[var(--hc-surface-raised)] border border-transparent" />
        ))}

        {/* Days of the Month */}
        {days.map((daySummary) => {
          const dayNumber = parseInt(daySummary.date.split('-')[2], 10);
          const isSelected = selectedDayDate === daySummary.date;
          const isToday = daySummary.date === todayStr;
          const isHoliday = Boolean(daySummary.holiday);

          let statusClass = 'bg-[var(--hc-surface)] border-[var(--hc-border)] text-[var(--hc-text)]';
          let badgeColor = '';

          switch (daySummary.status) {
            case 'RECORDED':
              statusClass = 'bg-[var(--hc-surface)] border-[var(--hc-border)] hover:border-[var(--hc-accent-border)]';
              break;
            case 'IN_PROGRESS':
              statusClass = 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50';
              badgeColor = 'bg-emerald-500 animate-pulse';
              break;
            case 'INCOMPLETE':
              statusClass = 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50';
              badgeColor = 'bg-amber-500';
              break;
            case 'EXCUSED':
              statusClass = 'bg-[var(--hc-accent-soft)] border-[var(--hc-accent-border)] hover:border-[var(--hc-accent)] text-[var(--hc-text)]';
              badgeColor = 'bg-[var(--hc-accent)]';
              break;
            case 'NO_RECORDS':
              statusClass = 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] text-[var(--hc-text-secondary)]';
              break;
            case 'REST_DAY':
              statusClass = 'bg-[var(--hc-surface-muted)] border-[var(--hc-border)] text-[var(--hc-text-muted)]';
              break;
            case 'FUTURE':
              statusClass = isHoliday
                ? 'bg-[var(--hc-accent-soft)] border-[var(--hc-accent-border)] text-[var(--hc-text)]'
                : 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] text-[var(--hc-text-muted)] opacity-60';
              break;
          }

          return (
            <AppTooltip
              key={daySummary.date}
              content={<DayTooltipContent day={daySummary} />}
            >
              <button
                type="button"
                onClick={() => onSelectDay(daySummary.date)}
                aria-label={`Dia ${dayNumber}, ${isHoliday ? `Feriado: ${daySummary.holiday?.name}, ` : ''}${daySummary.status}`}
                aria-pressed={isSelected}
                className={`h-15 sm:h-[4.25rem] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 relative cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-[var(--hc-accent)] hover:bg-[var(--hc-surface-raised)] group ${statusClass} ${
                  isSelected
                    ? 'ring-2 ring-[var(--hc-focus-ring)] border-[var(--hc-accent)] bg-[var(--hc-surface-raised)] shadow-lg'
                    : ''
                }`}
              >
                {/* Top Row: Day Number & Status Indicators */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      isToday
                        ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] flex items-center justify-center font-extrabold shadow-sm'
                        : isSelected
                        ? 'text-[var(--hc-accent)] font-extrabold'
                        : 'text-[var(--hc-text)]'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  <div className="flex items-center gap-1">
                    {isHoliday && (
                      <span className="text-amber-500 hover:text-amber-400 transition-colors">
                        <CalendarDays size={12} className="sm:w-3.5 sm:h-3.5" />
                      </span>
                    )}

                    {badgeColor && (
                      <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
                    )}

                    {daySummary.status === 'RECORDED' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                </div>

                {/* Bottom Row: Cell Status Label or Time Values */}
                <div className="overflow-hidden text-ellipsis whitespace-nowrap w-full">
                  {daySummary.status === 'RECORDED' && (
                    <div>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--hc-text)] block">
                        {formatMinutes(daySummary.totalWorkedMinutes)}
                      </span>
                      {daySummary.balanceMinutes !== null && daySummary.balanceMinutes !== 0 && (
                        <span
                          className={`text-[9px] sm:text-[10px] font-mono font-medium block ${
                            daySummary.balanceMinutes > 0 ? 'text-emerald-500' : 'text-amber-500'
                          }`}
                        >
                          {formatBalance(daySummary.balanceMinutes)}
                        </span>
                      )}
                    </div>
                  )}

                  {daySummary.status === 'EXCUSED' && (
                    <span className="text-[9px] sm:text-[10px] text-[var(--hc-accent-soft-foreground)] font-medium block truncate">
                      {daySummary.holiday ? daySummary.holiday.name : (daySummary.occurrence?.title || 'Abonado')}
                    </span>
                  )}

                  {daySummary.status === 'IN_PROGRESS' && (
                    <span className="text-[9px] sm:text-[10px] text-emerald-500 font-medium block truncate">
                      <span className="hidden sm:inline">Em andamento</span>
                      <span className="sm:hidden">Andamento</span>
                    </span>
                  )}

                  {daySummary.status === 'INCOMPLETE' && (
                    <span className="text-[9px] sm:text-[10px] text-amber-500 font-medium block truncate">
                      <span className="hidden sm:inline">Incompleto</span>
                      <span className="sm:hidden">Incomp.</span>
                    </span>
                  )}

                  {daySummary.status === 'NO_RECORDS' && (
                    <span className="text-[9px] sm:text-[10px] text-[var(--hc-text-secondary)] font-medium block truncate">
                      <span className="hidden sm:inline">Sem registro</span>
                      <span className="sm:hidden">Sem reg.</span>
                    </span>
                  )}

                  {daySummary.status === 'REST_DAY' && (
                    <span className="text-[9px] sm:text-[10px] text-[var(--hc-text-muted)] font-medium block truncate">
                      Folga
                    </span>
                  )}

                  {daySummary.status === 'FUTURE' && (
                    <span className="text-[9px] sm:text-[10px] text-[var(--hc-text-muted)] font-medium block truncate">
                      {daySummary.holiday ? daySummary.holiday.name : (daySummary.occurrence?.title || 'Futuro')}
                    </span>
                  )}
                </div>
              </button>
            </AppTooltip>
          );
        })}
      </div>
    </section>
  );
}

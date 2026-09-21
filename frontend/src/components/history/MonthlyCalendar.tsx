import { MonthlyDaySummary } from '../../types/work-day';
import { formatMinutes, formatBalance } from '../../utils/time';
import { getTodayDateStr } from '../../utils/date';

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
    <section aria-label="Calendário mensal" className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 text-center border-b border-slate-800/60 pb-3">
        {WEEKDAY_HEADERS.map((header) => (
          <span
            key={header}
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            {header}
          </span>
        ))}
      </div>

      {/* Grid of Day Cells */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {/* Lead-in Empty Cells */}
        {Array.from({ length: leadInSlots }).map((_, i) => (
          <div key={`lead-${i}`} className="h-16 sm:h-20 rounded-xl bg-slate-950/20 border border-transparent" />
        ))}

        {/* Days of the Month */}
        {days.map((daySummary) => {
          const dayNumber = parseInt(daySummary.date.split('-')[2], 10);
          const isSelected = selectedDayDate === daySummary.date;
          const isToday = daySummary.date === todayStr;

          let statusClass = 'bg-slate-900/60 border-slate-800/60 text-slate-300';
          let badgeColor = '';

          switch (daySummary.status) {
            case 'RECORDED':
              statusClass = 'bg-slate-900/90 border-slate-800 hover:border-slate-700';
              break;
            case 'IN_PROGRESS':
              statusClass = 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50';
              badgeColor = 'bg-emerald-400 animate-pulse';
              break;
            case 'INCOMPLETE':
              statusClass = 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50';
              badgeColor = 'bg-amber-400';
              break;
            case 'NO_RECORDS':
              statusClass = 'bg-slate-900/40 border-slate-800/40 text-slate-400';
              break;
            case 'REST_DAY':
              statusClass = 'bg-slate-950/40 border-slate-900 text-slate-500';
              break;
            case 'FUTURE':
              statusClass = 'bg-slate-950/20 border-transparent text-slate-600 opacity-40';
              break;
          }

          return (
            <button
              key={daySummary.date}
              type="button"
              onClick={() => onSelectDay(daySummary.date)}
              aria-label={`Dia ${dayNumber}, ${daySummary.status}`}
              aria-pressed={isSelected}
              className={`h-16 sm:h-20 p-1.5 sm:p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 relative cursor-pointer ${statusClass} ${
                isSelected
                  ? 'ring-2 ring-indigo-500 border-indigo-500 bg-slate-800/90 shadow-lg'
                  : ''
              }`}
            >
              {/* Top Row: Day Number & Status Indicators */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs sm:text-sm font-bold ${
                    isToday
                      ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold shadow-sm'
                      : isSelected
                      ? 'text-indigo-400 font-extrabold'
                      : 'text-slate-200'
                  }`}
                >
                  {dayNumber}
                </span>

                {badgeColor && (
                  <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
                )}

                {daySummary.status === 'RECORDED' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </div>

              {/* Bottom Row: Cell Status Label or Time Values */}
              <div className="overflow-hidden text-ellipsis whitespace-nowrap w-full">
                {daySummary.status === 'RECORDED' && (
                  <div>
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-white block">
                      {formatMinutes(daySummary.totalWorkedMinutes)}
                    </span>
                    {daySummary.balanceMinutes !== null && daySummary.balanceMinutes !== 0 && (
                      <span
                        className={`text-[9px] sm:text-[10px] font-mono font-medium block ${
                          daySummary.balanceMinutes > 0 ? 'text-emerald-400' : 'text-amber-400/90'
                        }`}
                      >
                        {formatBalance(daySummary.balanceMinutes)}
                      </span>
                    )}
                  </div>
                )}

                {daySummary.status === 'IN_PROGRESS' && (
                  <span className="text-[9px] sm:text-[10px] text-emerald-400 font-medium block truncate">
                    <span className="hidden sm:inline">Em andamento</span>
                    <span className="sm:hidden">Andamento</span>
                  </span>
                )}

                {daySummary.status === 'INCOMPLETE' && (
                  <span className="text-[9px] sm:text-[10px] text-amber-400 font-medium block truncate">
                    <span className="hidden sm:inline">Incompleto</span>
                    <span className="sm:hidden">Incomp.</span>
                  </span>
                )}

                {daySummary.status === 'NO_RECORDS' && (
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium block truncate">
                    <span className="hidden sm:inline">Sem registro</span>
                    <span className="sm:hidden">Sem reg.</span>
                  </span>
                )}

                {daySummary.status === 'REST_DAY' && (
                  <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium block truncate">
                    Folga
                  </span>
                )}

                {daySummary.status === 'FUTURE' && (
                  <span className="text-[9px] sm:text-[10px] text-slate-600 font-medium block truncate">
                    Futuro
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

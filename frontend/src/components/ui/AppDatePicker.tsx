import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface AppDatePickerProps {
  id?: string;
  label?: string;
  value: string; // ISO date 'YYYY-MM-DD'
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDisplayDate(isoDate: string): string {
  if (!isoDate || !isoDate.includes('-')) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export const AppDatePicker: React.FC<AppDatePickerProps> = ({
  id,
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
  required: _required = false,
  className = '',
  placeholder = 'DD/MM/YYYY',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize view year & month from value or current date
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value && value.includes('-')) return parseInt(value.split('-')[0], 10);
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value && value.includes('-')) return parseInt(value.split('-')[1], 10) - 1;
    return new Date().getMonth();
  });

  // Sync view year/month when value changes
  useEffect(() => {
    if (value && value.includes('-')) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dayNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(dayNum).padStart(2, '0');
    const selectedIso = `${viewYear}-${monthStr}-${dayStr}`;

    if (min && selectedIso < min) return;
    if (max && selectedIso > max) return;

    onChange(selectedIso);
    setIsOpen(false);
  };

  // Generate calendar grid days for viewMonth and viewYear
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const todayIso = new Date().toISOString().substring(0, 10);

  return (
    <div className={`space-y-1.5 relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          onClick={() => !disabled && setIsOpen(true)}
          className="block text-xs font-semibold text-slate-400 tracking-wide cursor-pointer hover:text-slate-200 transition-colors"
        >
          {label}
        </label>
      )}

      {/* Field Input Container — Whole field is clickable */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        role="button"
        className={`w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-all duration-150 shadow-inner group ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
        } ${isOpen ? 'ring-2 ring-indigo-500/50 border-indigo-500' : ''}`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <CalendarIcon className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors shrink-0" />
          <span
            className={`text-sm font-mono font-medium truncate ${
              value ? 'text-slate-100' : 'text-slate-500'
            }`}
          >
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>

        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
            title="Limpar data"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Custom Dark Theme Popover */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 z-50 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 backdrop-blur-md animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-sm font-bold text-slate-100 font-mono">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 text-center font-mono text-[11px] font-semibold text-slate-400">
            {WEEKDAY_SHORT.map((wd) => (
              <span key={wd} className="py-1">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Lead-in slots */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const monthStr = String(viewMonth + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const dayIso = `${viewYear}-${monthStr}-${dayStr}`;

              const isSelected = value === dayIso;
              const isToday = dayIso === todayIso;

              const isMinDisabled = Boolean(min && dayIso < min);
              const isMaxDisabled = Boolean(max && dayIso > max);
              const isDisabledDay = isMinDisabled || isMaxDisabled;

              return (
                <button
                  key={dayNum}
                  type="button"
                  disabled={isDisabledDay}
                  onClick={(e) => handleSelectDay(dayNum, e)}
                  className={`h-8 rounded-lg text-xs font-mono font-medium transition-all duration-150 flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                      : isToday
                      ? 'border border-indigo-500/50 text-indigo-300 font-bold hover:bg-indigo-500/20'
                      : isDisabledDay
                      ? 'text-slate-600 opacity-40 cursor-not-allowed'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

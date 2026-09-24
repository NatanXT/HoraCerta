import React, { useState, useRef, useEffect } from 'react';
import { Clock, Check, X } from 'lucide-react';

export interface AppTimePickerProps {
  id?: string;
  label?: string;
  value: string; // 'HH:mm'
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export const AppTimePicker: React.FC<AppTimePickerProps> = ({
  id,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  placeholder = 'HH:mm',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursContainerRef = useRef<HTMLDivElement>(null);
  const minutesContainerRef = useRef<HTMLDivElement>(null);

  // Sync internal input value when external value changes
  useEffect(() => {
    setInputValue(value || '');
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

  // Auto-scroll hour and minute lists when popover opens
  useEffect(() => {
    if (isOpen && value && value.includes(':')) {
      const [h, m] = value.split(':');
      const hourIdx = parseInt(h, 10);
      const minIdx = parseInt(m, 10);

      if (hoursContainerRef.current && !isNaN(hourIdx)) {
        const item = hoursContainerRef.current.children[hourIdx] as HTMLElement;
        if (item) item.scrollIntoView({ block: 'nearest' });
      }

      if (minutesContainerRef.current && !isNaN(minIdx)) {
        const item = minutesContainerRef.current.children[minIdx] as HTMLElement;
        if (item) item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, value]);

  const [currentHour, currentMinute] = value && value.includes(':') ? value.split(':') : ['08', '00'];

  const handleHourSelect = (h: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTime = `${h}:${currentMinute || '00'}`;
    setInputValue(newTime);
    onChange(newTime);
  };

  const handleMinuteSelect = (m: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTime = `${currentHour || '08'}:${m}`;
    setInputValue(newTime);
    onChange(newTime);
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // If matches HH:mm format, propagate
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
      onChange(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      setIsOpen((prev) => !prev);
    }
  };

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
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2 flex items-center justify-between transition-all duration-150 shadow-inner group ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500'
        } ${isOpen ? 'ring-2 ring-indigo-500/50 border-indigo-500' : ''}`}
      >
        <div className="flex items-center gap-2.5 flex-1">
          <Clock className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors shrink-0" />
          <input
            id={id}
            type="text"
            value={inputValue}
            placeholder={placeholder}
            maxLength={5}
            disabled={disabled}
            required={required}
            onChange={handleManualInputChange}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen(true);
            }}
            className="w-full bg-transparent text-sm font-mono font-semibold text-slate-100 placeholder-slate-500 focus:outline-none scheme-dark"
          />
        </div>

        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInputValue('');
              onChange('');
            }}
            className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
            title="Limpar horário"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Custom Time Picker Popover */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 z-50 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 backdrop-blur-md animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-400 font-mono">
            <span className="w-1/2 text-center">Hora</span>
            <span className="w-1/2 text-center">Minuto</span>
          </div>

          <div className="grid grid-cols-2 gap-2 h-44">
            {/* Hours List */}
            <div
              ref={hoursContainerRef}
              className="overflow-y-auto space-y-1 pr-1 custom-scrollbar"
            >
              {HOURS.map((h) => {
                const isSelected = h === currentHour;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={(e) => handleHourSelect(h, e)}
                    className={`w-full py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{h}</span>
                    {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Minutes List */}
            <div
              ref={minutesContainerRef}
              className="overflow-y-auto space-y-1 pr-1 custom-scrollbar"
            >
              {MINUTES.map((m) => {
                const isSelected = m === currentMinute;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={(e) => handleMinuteSelect(m, e)}
                    className={`w-full py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{m}</span>
                    {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Popover Footer Button */}
          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Ok
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

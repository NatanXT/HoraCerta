import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface AppSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface AppSelectProps {
  id?: string;
  label?: string;
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export const AppSelect: React.FC<AppSelectProps> = ({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  required: _required = false,
  className = '',
  placeholder = 'Selecione uma opção...',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Click outside handler
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  const handleSelectOption = (optValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(optValue);
    setIsOpen(false);
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
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        role="combobox"
        className={`w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-all duration-150 shadow-inner group ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
        } ${isOpen ? 'ring-2 ring-indigo-500/50 border-indigo-500' : ''}`}
      >
        <span
          className={`text-sm font-medium truncate ${
            selectedOption ? 'text-slate-100 font-semibold' : 'text-slate-500'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </div>

      {/* Custom Dark Theme Popover */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-2 z-50 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 space-y-1 backdrop-blur-md animate-fadeIn max-h-60 overflow-y-auto custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={(e) => handleSelectOption(opt.value, e)}
                className={`p-2.5 rounded-xl text-xs sm:text-sm transition-all duration-150 flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  {opt.description && (
                    <span className="text-[11px] text-slate-500 font-normal">{opt.description}</span>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { PopoverPortal } from './PopoverPortal';

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
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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
    <div className={`space-y-1.5 relative ${className}`} ref={triggerRef}>
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
        className={`w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-all duration-150 shadow-inner group ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-[var(--hc-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)]'
        } ${isOpen ? 'ring-2 ring-[var(--hc-accent-soft)] border-[var(--hc-accent)]' : ''}`}
      >
        <span
          className={`text-sm font-medium truncate ${
            selectedOption ? 'text-[var(--hc-text)] font-semibold' : 'text-[var(--hc-text-muted)]'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          className={`w-4 h-4 text-[var(--hc-text-muted)] group-hover:text-[var(--hc-text)] transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-[var(--hc-accent)]' : ''
          }`}
        />
      </div>

      {/* Custom Theme Popover via Portal */}
      <PopoverPortal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        matchWidth={true}
      >
        <div
          role="listbox"
          className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl shadow-2xl p-1.5 space-y-1 backdrop-blur-md animate-fadeIn max-h-60 overflow-y-auto custom-scrollbar text-[var(--hc-text)]"
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
                    ? 'bg-[var(--hc-accent-soft)] text-[var(--hc-accent-soft-foreground)] font-semibold border border-[var(--hc-accent-border)]'
                    : 'text-[var(--hc-text-secondary)] hover:bg-[var(--hc-surface-raised)] hover:text-[var(--hc-text)]'
                }`}
              >
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  {opt.description && (
                    <span className="text-[11px] text-[var(--hc-text-muted)] font-normal">{opt.description}</span>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-[var(--hc-accent)] shrink-0" />}
              </div>
            );
          })}
        </div>
      </PopoverPortal>
    </div>
  );
};

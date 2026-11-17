import React from 'react';
import { Clock, Coffee, LogOut, AlertTriangle, X } from 'lucide-react';
import { ToastNotification, ReminderType } from '../types';

interface RemindersToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

function getIconForType(type: ReminderType) {
  switch (type) {
    case 'ENTRY':
      return <Clock className="w-5 h-5 text-indigo-500 shrink-0" />;
    case 'BREAK_RETURN':
      return <Coffee className="w-5 h-5 text-amber-500 shrink-0" />;
    case 'EXIT':
      return <LogOut className="w-5 h-5 text-emerald-500 shrink-0" />;
    case 'OVERTIME':
      return <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />;
    default:
      return <Clock className="w-5 h-5 text-[var(--hc-accent)] shrink-0" />;
  }
}

function getBadgeColor(type: ReminderType) {
  switch (type) {
    case 'ENTRY':
      return 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400';
    case 'BREAK_RETURN':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
    case 'EXIT':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
    case 'OVERTIME':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-400';
    default:
      return 'border-[var(--hc-accent-border)] bg-[var(--hc-accent-soft)] text-[var(--hc-accent)]';
  }
}

export const RemindersToastContainer: React.FC<RemindersToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Lembretes do sistema"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-sm z-[60] flex flex-col gap-3 pointer-events-none select-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none motion-reduce:transition-none"
        >
          <div className={`p-2 rounded-xl border shrink-0 ${getBadgeColor(toast.type)}`}>
            {getIconForType(toast.type)}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="text-xs font-bold text-[var(--hc-text)] tracking-tight break-words">
              {toast.title}
            </h4>
            <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5 leading-relaxed break-words">
              {toast.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="p-1 rounded-lg text-[var(--hc-text-muted)] hover:text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] transition-colors cursor-pointer shrink-0"
            aria-label="Fechar lembrete"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

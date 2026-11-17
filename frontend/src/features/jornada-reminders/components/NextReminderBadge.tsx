import React from 'react';
import { Bell, Clock, Coffee, LogOut, AlertTriangle } from 'lucide-react';
import { ScheduledReminder, ReminderType } from '../types';
import { AppTooltip } from '../../../components/ui/AppTooltip';

interface NextReminderBadgeProps {
  reminder: ScheduledReminder | null;
  enabled: boolean;
}

function getIcon(type: ReminderType) {
  switch (type) {
    case 'ENTRY':
      return <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    case 'BREAK_RETURN':
      return <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'EXIT':
      return <LogOut className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case 'OVERTIME':
      return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    default:
      return <Bell className="w-3.5 h-3.5 text-[var(--hc-accent)] shrink-0" />;
  }
}

function getEventTitle(type: ReminderType, eventTime: string): string {
  switch (type) {
    case 'ENTRY':
      return `Entrada às ${eventTime}`;
    case 'BREAK_RETURN':
      return `Retorno às ${eventTime}`;
    case 'EXIT':
      return `Saída prevista às ${eventTime}`;
    case 'OVERTIME':
      return `Tolerância até ${eventTime}`;
    default:
      return `Evento às ${eventTime}`;
  }
}

export const NextReminderBadge: React.FC<NextReminderBadgeProps> = ({ reminder, enabled }) => {
  if (!enabled || !reminder) {
    return null;
  }

  const tooltipText = `${reminder.title} • Horário previsto: ${reminder.targetTimeFormatted} • Aviso programado para ${reminder.triggerTimeFormatted}`;

  return (
    <AppTooltip content={tooltipText}>
      <div
        tabIndex={0}
        role="region"
        aria-label={tooltipText}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--hc-surface)] border border-[var(--hc-border)] text-xs text-[var(--hc-text-secondary)] shadow-sm hover:border-[var(--hc-accent-border)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent)] transition-colors select-none cursor-pointer"
      >
        <div className="p-1 rounded-lg bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
          {getIcon(reminder.type)}
        </div>
        <div className="flex items-center gap-1.5 font-medium flex-wrap">
          <span className="text-[var(--hc-text-muted)] font-normal hidden sm:inline">
            Próximo lembrete:
          </span>
          <span className="text-[var(--hc-text)] font-semibold">
            {getEventTitle(reminder.type, reminder.targetTimeFormatted)}
          </span>
          <span className="text-[11px] text-[var(--hc-text-muted)] font-normal">
            (aviso às {reminder.triggerTimeFormatted})
          </span>
        </div>
      </div>
    </AppTooltip>
  );
};

import React from 'react';
import { LucideIcon } from 'lucide-react';

export type MetricVariant =
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'purple'
  | 'blue'
  | 'slate';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: MetricVariant;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  onClick?: () => void;
  className?: string;
}

const variantStyles: Record<
  MetricVariant,
  {
    cardBorder: string;
    cardHoverBorder: string;
    cardHoverBg: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
  }
> = {
  indigo: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-[var(--hc-accent-border)]',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-[var(--hc-accent-soft)] border-[var(--hc-accent-border)] text-[var(--hc-accent-soft-foreground)] group-hover:scale-110',
    iconColor: 'text-[var(--hc-accent)]',
    valueColor: 'text-[var(--hc-text)]',
  },
  emerald: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-emerald-500/40',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 group-hover:scale-110',
    iconColor: 'text-emerald-500',
    valueColor: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-amber-500/40',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-500 group-hover:scale-110',
    iconColor: 'text-amber-500',
    valueColor: 'text-amber-600 dark:text-amber-400',
  },
  rose: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-rose-500/40',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-500 group-hover:scale-110',
    iconColor: 'text-rose-500',
    valueColor: 'text-rose-600 dark:text-rose-400',
  },
  sky: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-sky-500/40',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-sky-500/10 border-sky-500/20 text-sky-500 group-hover:scale-110',
    iconColor: 'text-sky-500',
    valueColor: 'text-sky-600 dark:text-sky-400',
  },
  purple: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-purple-500/40',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-500 group-hover:scale-110',
    iconColor: 'text-purple-500',
    valueColor: 'text-purple-600 dark:text-purple-400',
  },
  blue: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-blue-500/40',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-500 group-hover:scale-110',
    iconColor: 'text-blue-500',
    valueColor: 'text-blue-600 dark:text-blue-400',
  },
  slate: {
    cardBorder: 'border-[var(--hc-border)]',
    cardHoverBorder: 'hover:border-[var(--hc-border-subtle)]',
    cardHoverBg: 'hover:bg-[var(--hc-surface-raised)]',
    iconBg: 'bg-[var(--hc-surface-raised)] border-[var(--hc-border)] text-[var(--hc-text-muted)] group-hover:scale-110',
    iconColor: 'text-[var(--hc-text-muted)]',
    valueColor: 'text-[var(--hc-text)]',
  },
};

const badgeStyles: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  error: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  neutral: 'bg-[var(--hc-surface-raised)] text-[var(--hc-text-secondary)] border-[var(--hc-border)]',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'indigo',
  badge,
  badgeVariant = 'neutral',
  onClick,
  className = '',
}) => {
  const styles = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`group relative bg-[var(--hc-surface)] border ${styles.cardBorder} ${styles.cardHoverBorder} ${styles.cardHoverBg} rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs sm:text-sm font-semibold text-[var(--hc-text-secondary)] tracking-wide uppercase font-mono">
          {title}
        </span>
        {Icon && (
          <div
            className={`p-2 rounded-xl border transition-all duration-200 ${styles.iconBg}`}
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${styles.valueColor}`}>
          {value}
        </span>
        {badge && (
          <span
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
              badgeStyles[badgeVariant] || badgeStyles.neutral
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-[var(--hc-text-muted)] font-medium leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};

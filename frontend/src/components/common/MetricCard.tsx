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
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-indigo-500/40',
    cardHoverBg: 'hover:bg-slate-900/90 hover:shadow-indigo-500/5',
    iconBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    valueColor: 'text-slate-100',
  },
  emerald: {
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-emerald-500/40',
    cardHoverBg: 'hover:bg-slate-900/90 hover:shadow-emerald-500/5',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    valueColor: 'text-emerald-400',
  },
  amber: {
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-amber-500/40',
    cardHoverBg: 'hover:bg-slate-900/90 hover:shadow-amber-500/5',
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/20',
    iconColor: 'text-amber-400',
    valueColor: 'text-amber-400',
  },
  rose: {
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-rose-500/40',
    cardHoverBg: 'hover:bg-slate-900/90 hover:shadow-rose-500/5',
    iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400 group-hover:scale-110 group-hover:bg-rose-500/20',
    iconColor: 'text-rose-400',
    valueColor: 'text-rose-400',
  },
  sky: {
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-sky-500/40',
    cardHoverBg: 'hover:bg-slate-900/90 hover:shadow-sky-500/5',
    iconBg: 'bg-sky-500/10 border-sky-500/20 text-sky-400 group-hover:scale-110 group-hover:bg-sky-500/20',
    iconColor: 'text-sky-400',
    valueColor: 'text-sky-400',
  },
  purple: {
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-purple-500/40',
    cardHoverBg: 'hover:bg-slate-900/90 hover:shadow-purple-500/5',
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/20',
    iconColor: 'text-purple-400',
    valueColor: 'text-purple-300',
  },
  blue: {
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-blue-500/40',
    cardHoverBg: 'hover:bg-slate-900/90 hover:shadow-blue-500/5',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20',
    iconColor: 'text-blue-400',
    valueColor: 'text-blue-400',
  },
  slate: {
    cardBorder: 'border-slate-800/80',
    cardHoverBorder: 'hover:border-slate-700',
    cardHoverBg: 'hover:bg-slate-900/90',
    iconBg: 'bg-slate-800/80 border-slate-700/60 text-slate-300 group-hover:scale-110 group-hover:bg-slate-700/80',
    iconColor: 'text-slate-400',
    valueColor: 'text-slate-100',
  },
};

const badgeStyles: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  neutral: 'bg-slate-800 text-slate-400 border-slate-700',
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
      className={`group relative bg-slate-900/70 border ${styles.cardBorder} ${styles.cardHoverBorder} ${styles.cardHoverBg} rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs sm:text-sm font-semibold text-slate-400 tracking-wide uppercase font-mono">
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
        <p className="mt-1.5 text-xs text-slate-400 font-medium leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};

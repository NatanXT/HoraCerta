import React, { useState } from 'react';
import {
  Target,
  Trophy,
  AlertTriangle,
  Clock,
  Trash2,
  TrendingDown,
  TrendingUp,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { SavedBankHoursGoal, GoalProgressResult, CalendarStatus, CompensationSimulationResult } from './types';
import { formatBalance, formatHoursMinutes } from '../../utils/time';
import { formatFullDate } from '../../utils/date';

export interface BankHoursGoalTrackerProps {
  goal: SavedBankHoursGoal;
  progress: GoalProgressResult;
  forecast?: CompensationSimulationResult | null;
  calendarStatus?: CalendarStatus;
  calendarError?: string | null;
  onRetryCalendar?: () => void;
  onDiscardGoal: () => void;
  onOpenSimulator?: () => void;
}

export const BankHoursGoalTracker: React.FC<BankHoursGoalTrackerProps> = ({
  goal,
  progress,
  forecast,
  calendarStatus = 'ready',
  calendarError: _calendarError,
  onRetryCalendar,
  onDiscardGoal,
  onOpenSimulator,
}) => {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const getStatusBadge = () => {
    switch (progress.status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            Meta Concluída
          </span>
        );
      case 'REGRESSED':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
            Saldo Recuou
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            Prazo Expirado
          </span>
        );
      case 'NOT_STARTED':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-[var(--hc-text-secondary)] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Não Iniciada
          </span>
        );
      case 'IN_PROGRESS':
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-[var(--hc-accent-soft)] border border-[var(--hc-border)] text-[var(--hc-accent)] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            Em Andamento
          </span>
        );
    }
  };

  const getProgressBarColor = () => {
    if (progress.status === 'COMPLETED') return 'bg-emerald-500';
    if (progress.status === 'REGRESSED') return 'bg-rose-500';
    if (progress.status === 'EXPIRED') return 'bg-amber-500';
    return 'bg-[var(--hc-accent)]';
  };

  const renderForecastDetails = () => (
    <div className="flex items-start gap-2">
      <Clock className="w-4 h-4 text-[var(--hc-accent)] shrink-0 mt-0.5" />
      <div className="space-y-0.5 w-full">
        <span>
          Faltam <strong>{formatHoursMinutes(progress.remainingMinutes)}</strong> para atingir sua meta.
        </span>
        {calendarStatus === 'loading' ? (
          <div className="text-[11px] text-[var(--hc-text-muted)] italic pt-0.5">
            Consultando calendário para calcular a previsão diária...
          </div>
        ) : calendarStatus === 'error' ? (
          <div className="flex items-center justify-between text-[11px] text-amber-500 pt-0.5">
            <span>Previsão temporariamente indisponível (não foi possível carregar o calendário da meta).</span>
            {onRetryCalendar && (
              <button
                type="button"
                onClick={onRetryCalendar}
                className="underline font-semibold cursor-pointer hover:text-amber-400 ml-2"
              >
                Tentar novamente
              </button>
            )}
          </div>
        ) : forecast && forecast.isValid ? (
          forecast.hasEligibleDays ? (
            <div className="pt-0.5">
              Com <strong>{forecast.breakdown.eligibleDaysCount} dias úteis restantes</strong> até {formatFullDate(goal.targetDateStr)}, você precisa compensar aproximadamente{' '}
              <strong className="text-[var(--hc-text)]">
                +{forecast.suggestedDailyMinutes} min/dia útil
              </strong>{' '}
              a partir de hoje.
            </div>
          ) : (
            <div className="pt-0.5 text-amber-500 font-medium">
              Não há dias úteis elegíveis restantes até o prazo final ({formatFullDate(goal.targetDateStr)}).
            </div>
          )
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--hc-border)]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[var(--hc-accent-soft)] text-[var(--hc-accent)]">
            <Target className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--hc-text)] tracking-tight">
                {goal.title || 'Meta de Compensação Ativa'}
              </h3>
              {getStatusBadge()}
            </div>
            <p className="text-xs text-[var(--hc-text-secondary)] flex items-center gap-2 mt-0.5">
              <span>Criada em {formatFullDate(goal.createdAtStr)}</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-[var(--hc-text-muted)]" />
                Prazo: {formatFullDate(goal.targetDateStr)}
              </span>
            </p>
          </div>
        </div>

        {/* Actions Button Bar */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onOpenSimulator && (
            <button
              type="button"
              onClick={onOpenSimulator}
              className="px-3 py-1.5 rounded-xl bg-[var(--hc-surface-raised)] hover:bg-[var(--hc-surface)] text-[var(--hc-text)] border border-[var(--hc-border)] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--hc-accent)]" />
              <span>Simular novo cenário</span>
            </button>
          )}

          {!showDiscardConfirm ? (
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(true)}
              className="p-1.5 rounded-xl hover:bg-rose-500/10 text-[var(--hc-text-muted)] hover:text-rose-500 border border-transparent hover:border-rose-500/20 text-xs transition-colors cursor-pointer"
              title="Encerrar meta"
              aria-label="Encerrar meta"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-1 rounded-xl text-xs">
              <span className="text-rose-500 px-1 font-medium text-[11px]">
                Descartar meta?
              </span>
              <button
                type="button"
                onClick={onDiscardGoal}
                className="px-2 py-0.5 rounded-lg bg-rose-500 text-white font-semibold text-[11px] hover:bg-rose-600 transition-colors cursor-pointer"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-2 py-0.5 rounded-lg bg-[var(--hc-surface)] text-[var(--hc-text-secondary)] font-semibold text-[11px] hover:bg-[var(--hc-surface-raised)] transition-colors cursor-pointer"
              >
                Não
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-[var(--hc-text-secondary)]">
            Evolução líquida em direção à meta
          </span>
          <span className="text-[var(--hc-text)] font-mono font-bold">
            {progress.progressPercentage}%
          </span>
        </div>

        <div
          className="w-full h-3 rounded-full bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] overflow-hidden"
          role="progressbar"
          aria-valuenow={progress.progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full transition-all duration-300 rounded-full ${getProgressBarColor()}`}
            style={{ width: `${Math.min(100, Math.max(0, progress.progressPercentage))}%` }}
          />
        </div>
      </div>

      {/* 4 Comparative Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Baseline */}
        <div className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
          <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
            Saldo Inicial (Criação)
          </span>
          <strong className="text-sm font-mono font-bold text-[var(--hc-text)] block mt-0.5">
            {formatBalance(progress.baselineBalanceMinutes)}
          </strong>
        </div>

        {/* Current Official Balance */}
        <div className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
          <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
            Saldo Oficial Atual
          </span>
          <strong
            className={`text-sm font-mono font-bold block mt-0.5 ${
              progress.currentBalanceMinutes > 0
                ? 'text-emerald-500'
                : progress.currentBalanceMinutes === 0
                ? 'text-[var(--hc-text)]'
                : 'text-amber-500'
            }`}
          >
            {formatBalance(progress.currentBalanceMinutes)}
          </strong>
        </div>

        {/* Target Balance */}
        <div className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
          <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
            Saldo Objetivo
          </span>
          <strong className="text-sm font-mono font-bold text-[var(--hc-text)] block mt-0.5">
            {formatBalance(progress.targetBalanceMinutes)}
          </strong>
        </div>

        {/* Remaining to Compensate */}
        <div className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)]">
          <span className="text-[11px] font-semibold text-[var(--hc-text-secondary)] block">
            Restante a Compensar
          </span>
          <strong
            className={`text-sm font-mono font-bold block mt-0.5 ${
              progress.remainingMinutes === 0
                ? 'text-emerald-500'
                : 'text-[var(--hc-text)]'
            }`}
          >
            {progress.remainingMinutes === 0
              ? 'Concluído'
              : formatHoursMinutes(progress.remainingMinutes)}
          </strong>
        </div>
      </div>

      {/* Dynamic Forecast / Guidance Notice */}
      <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs text-[var(--hc-text-secondary)] space-y-1">
        {progress.status === 'COMPLETED' ? (
          <div className="flex items-center gap-2 text-emerald-500 font-semibold">
            <Trophy className="w-4 h-4 shrink-0" />
            <span>
              Parabéns! Sua meta de saldo foi alcançada com base na apuração oficial consolidada.
            </span>
          </div>
        ) : progress.status === 'EXPIRED' ? (
          <div className="flex items-center gap-2 text-amber-500 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              O prazo limite definido para esta meta encerrou em{' '}
              <strong>{formatFullDate(goal.targetDateStr)}</strong>. Você ainda pode manter a meta para acompanhamento ou definir um novo prazo.
            </span>
          </div>
        ) : progress.status === 'REGRESSED' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-rose-500 font-medium">
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span>
                Atenção: seu saldo oficial recuou em relação ao início da meta. Para retomar o progresso, será necessário compensar o débito acumulado adicional.
              </span>
            </div>
            {renderForecastDetails()}
          </div>
        ) : (
          renderForecastDetails()
        )}

        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[var(--hc-text-muted)] border-t border-[var(--hc-border)] mt-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            Esta meta é salva localmente neste navegador/dispositivo e consome seu saldo oficial em tempo real.
          </span>
        </div>
      </div>
    </div>
  );
};

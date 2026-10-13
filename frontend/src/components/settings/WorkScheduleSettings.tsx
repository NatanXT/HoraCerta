import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Save, Info, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { WorkScheduleDay, Weekday } from '../../types/settings';
import { formatMinutes, formatDurationInput, parseDurationInput } from '../../utils/time';

interface WorkScheduleSettingsProps {
  days: WorkScheduleDay[];
  loading: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  onSave: (days: WorkScheduleDay[]) => Promise<boolean>;
}

interface LocalDayState {
  weekday: Weekday;
  label: string;
  isWorkDay: boolean;
  durationInput: string;
}

const WEEKDAY_CONFIG: { weekday: Weekday; label: string }[] = [
  { weekday: 'MONDAY', label: 'Segunda-feira' },
  { weekday: 'TUESDAY', label: 'Terça-feira' },
  { weekday: 'WEDNESDAY', label: 'Quarta-feira' },
  { weekday: 'THURSDAY', label: 'Quinta-feira' },
  { weekday: 'FRIDAY', label: 'Sexta-feira' },
  { weekday: 'SATURDAY', label: 'Sábado' },
  { weekday: 'SUNDAY', label: 'Domingo' },
];

export const WorkScheduleSettings: React.FC<WorkScheduleSettingsProps> = ({
  days,
  loading,
  successMessage,
  errorMessage,
  onSave,
}) => {
  const [localDays, setLocalDays] = useState<LocalDayState[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const dayMap = new Map<Weekday, number>();
    for (const d of days) {
      dayMap.set(d.weekday, d.expectedMinutes);
    }

    const initial = WEEKDAY_CONFIG.map(({ weekday, label }) => {
      const minutes = dayMap.get(weekday) ?? 0;
      const isWork = minutes > 0;
      return {
        weekday,
        label,
        isWorkDay: isWork,
        durationInput: isWork ? formatDurationInput(minutes) : '08:00',
      };
    });

    setLocalDays(initial);
  }, [days]);

  const handleToggleWorkDay = (weekday: Weekday) => {
    setLocalDays((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const newIsWork = !d.isWorkDay;
        return {
          ...d,
          isWorkDay: newIsWork,
          durationInput: newIsWork && d.durationInput === '00:00' ? '08:00' : d.durationInput,
        };
      })
    );
  };

  const handleDurationChange = (weekday: Weekday, value: string) => {
    setLocalDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, durationInput: value } : d))
    );
  };

  const weeklyTotalMinutes = useMemo(() => {
    let total = 0;
    for (const d of localDays) {
      if (d.isWorkDay) {
        const parsed = parseDurationInput(d.durationInput);
        if (parsed !== null) {
          total += parsed;
        }
      }
    }
    return total;
  }, [localDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const payloadDays: WorkScheduleDay[] = [];

    for (const d of localDays) {
      if (!d.isWorkDay) {
        payloadDays.push({ weekday: d.weekday, expectedMinutes: 0 });
      } else {
        const parsed = parseDurationInput(d.durationInput);
        if (parsed === null) {
          setValidationError(`Duração inválida para ${d.label}. Utilize o formato HH:MM (ex: 08:00).`);
          return;
        }
        payloadDays.push({ weekday: d.weekday, expectedMinutes: parsed });
      }
    }

    await onSave(payloadDays);
  };

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700/60 p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-700/60">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
          <CalendarDays className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Jornada semanal</h2>
          <p className="text-sm text-slate-400">
            Configure os dias de trabalho e as horas diárias esperadas.
          </p>
        </div>
      </div>

      {(successMessage || errorMessage || validationError) && (
        <div className="mb-6 space-y-2" aria-live="polite">
          {successMessage && (
            <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {(errorMessage || validationError) && (
            <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError || errorMessage}</span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          {localDays.map((d) => (
            <div
              key={d.weekday}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] gap-3"
            >
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <span className="text-sm font-medium text-[var(--hc-text)] min-w-[120px]">
                  {d.label}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleWorkDay(d.weekday)}
                  disabled={loading}
                  aria-label={`Alternar dia de trabalho para ${d.label}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    d.isWorkDay
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-[var(--hc-surface)] text-[var(--hc-text-muted)] border border-[var(--hc-border)] hover:bg-[var(--hc-surface-raised)]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      d.isWorkDay ? 'bg-emerald-500' : 'bg-[var(--hc-text-muted)]'
                    }`}
                  />
                  <span>{d.isWorkDay ? 'Trabalha' : 'Folga'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor={`duration-${d.weekday}`} className="sr-only">
                  Duração para {d.label}
                </label>
                {d.isWorkDay ? (
                  <div className="relative flex items-center">
                    <Clock className="w-4 h-4 text-[var(--hc-text-muted)] absolute left-3" />
                    <input
                      id={`duration-${d.weekday}`}
                      type="text"
                      value={d.durationInput}
                      onChange={(e) => handleDurationChange(d.weekday, e.target.value)}
                      disabled={loading}
                      placeholder="08:00"
                      className="w-28 pl-9 pr-3 py-1.5 bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-lg text-[var(--hc-text)] text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)] disabled:opacity-50"
                    />
                  </div>
                ) : (
                  <span className="w-28 py-1.5 px-3 text-center text-sm font-mono text-[var(--hc-text-muted)] bg-[var(--hc-surface)] rounded-lg border border-[var(--hc-border)]">
                    Folga
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] gap-3">
          <span className="text-sm font-medium text-[var(--hc-accent-soft-foreground)]">Carga semanal esperada</span>
          <span className="text-lg font-bold text-[var(--hc-accent)] font-mono">
            {formatMinutes(weeklyTotalMinutes)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs text-[var(--hc-text-secondary)] flex items-start gap-3">
          <Info className="w-4 h-4 text-[var(--hc-accent)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-[var(--hc-text)]">Preservação do histórico</p>
            <p>
              Alterações na jornada passam a valer a partir de hoje. Dias que já possuem registros de ponto
              ou snaps de jornada mantêm a jornada histórica salva sem modificações retroativas.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-[var(--hc-accent-foreground)] font-medium text-sm rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Salvando...' : 'Salvar jornada'}</span>
          </button>
        </div>
      </form>
    </section>
  );
};

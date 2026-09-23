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
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-700/50 gap-3"
            >
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <span className="text-sm font-medium text-slate-200 min-w-[120px]">
                  {d.label}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleWorkDay(d.weekday)}
                  disabled={loading}
                  aria-label={`Alternar dia de trabalho para ${d.label}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    d.isWorkDay
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700/80 hover:bg-slate-700/60'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      d.isWorkDay ? 'bg-emerald-400' : 'bg-slate-500'
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
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3" />
                    <input
                      id={`duration-${d.weekday}`}
                      type="text"
                      value={d.durationInput}
                      onChange={(e) => handleDurationChange(d.weekday, e.target.value)}
                      disabled={loading}
                      placeholder="08:00"
                      className="w-28 pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    />
                  </div>
                ) : (
                  <span className="w-28 py-1.5 px-3 text-center text-sm font-mono text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
                    Folga
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-blue-950/30 border border-blue-800/40 gap-3">
          <span className="text-sm font-medium text-slate-300">Carga semanal esperada</span>
          <span className="text-lg font-bold text-blue-400 font-mono">
            {formatMinutes(weeklyTotalMinutes)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-slate-400 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-slate-300">Preservação do histórico</p>
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
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Salvando...' : 'Salvar jornada'}</span>
          </button>
        </div>
      </form>
    </section>
  );
};

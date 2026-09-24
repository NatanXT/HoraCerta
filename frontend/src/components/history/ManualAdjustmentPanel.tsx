import React, { useState, useEffect } from 'react';
import {
  PencilLine,
  Plus,
  Trash2,
  Save,
  X,
  History,
  TriangleAlert,
  Clock3,
} from 'lucide-react';
import { MonthlyDaySummary } from '../../types/work-day';
import { ManualInterval, WorkDayAdjustmentSnapshotEntry } from '../../types/manual-adjustment';
import { useManualAdjustment } from '../../hooks/useManualAdjustment';
import { formatFullDate, formatDateTime } from '../../utils/date';
import { formatMinutes, formatTime } from '../../utils/time';
import { TimeInput } from '../common/TimeInput';

interface ManualAdjustmentPanelProps {
  day: MonthlyDaySummary;
  onClose: () => void;
  onSaved: (updatedSummary: MonthlyDaySummary) => void;
}

export function ManualAdjustmentPanel({ day, onClose, onSaved }: ManualAdjustmentPanelProps) {
  const {
    adjustments,
    loadingAdjustments,
    saving,
    error,
    successMessage,
    fetchAdjustments,
    submitAdjustment,
    clearFeedback,
  } = useManualAdjustment();

  const [reason, setReason] = useState<string>('');
  const [intervals, setIntervals] = useState<ManualInterval[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize intervals from active day entries
  useEffect(() => {
    clearFeedback();
    setValidationError(null);
    fetchAdjustments(day.date);

    if (day.entries && day.entries.length > 0) {
      const sorted = [...day.entries].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const pairs: ManualInterval[] = [];
      for (let i = 0; i < sorted.length; i += 2) {
        const inEntry = sorted[i];
        const outEntry = sorted[i + 1];

        const clockInStr = inEntry ? formatTime(inEntry.timestamp) : '';
        const clockOutStr = outEntry ? formatTime(outEntry.timestamp) : '';

        pairs.push({ clockIn: clockInStr, clockOut: clockOutStr });
      }

      setIntervals(pairs.length > 0 ? pairs : [{ clockIn: '', clockOut: '' }]);
    } else {
      setIntervals([{ clockIn: '', clockOut: '' }]);
    }
  }, [day.date, day.entries, fetchAdjustments, clearFeedback]);

  const handleAddInterval = () => {
    if (intervals.length >= 10) return;
    setIntervals([...intervals, { clockIn: '', clockOut: '' }]);
  };

  const handleRemoveInterval = (index: number) => {
    if (intervals.length <= 1) return;
    setIntervals(intervals.filter((_, i) => i !== index));
  };

  const handleIntervalChange = (
    index: number,
    field: 'clockIn' | 'clockOut',
    value: string
  ) => {
    const updated = [...intervals];
    updated[index] = { ...updated[index], [field]: value };
    setIntervals(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      setValidationError('O motivo da correção deve conter no mínimo 5 caracteres.');
      return;
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    for (let i = 0; i < intervals.length; i++) {
      const { clockIn, clockOut } = intervals[i];
      if (!clockIn || !clockOut) {
        setValidationError(`Preencha o horário de entrada e saída do Intervalo ${i + 1}.`);
        return;
      }

      if (!timeRegex.test(clockIn) || !timeRegex.test(clockOut)) {
        setValidationError(`Formato de horário inválido no Intervalo ${i + 1}. Use HH:mm.`);
        return;
      }

      if (clockIn >= clockOut) {
        setValidationError(
          `No Intervalo ${i + 1}, a entrada (${clockIn}) deve ser anterior à saída (${clockOut}).`
        );
        return;
      }

      if (i > 0) {
        const prevOut = intervals[i - 1].clockOut;
        if (clockIn <= prevOut) {
          setValidationError(
            `O Intervalo ${i + 1} (${clockIn}) não pode se sobrepor ou coincidir com o intervalo anterior (${prevOut}).`
          );
          return;
        }
      }
    }

    const res = await submitAdjustment(day.date, {
      reason: trimmedReason,
      intervals,
    });

    if (res) {
      onSaved(res.summary);
    }
  };

  // Helper to format snapshot entries into readable intervals for audit history
  const formatSnapshotIntervals = (entries: WorkDayAdjustmentSnapshotEntry[]) => {
    if (!entries || entries.length === 0) return 'Nenhum registro';

    const sorted = [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const formattedPairs: string[] = [];
    for (let i = 0; i < sorted.length; i += 2) {
      const inTime = formatTime(sorted[i].timestamp);
      const outTime = sorted[i + 1] ? formatTime(sorted[i + 1].timestamp) : '--:--';
      formattedPairs.push(`${inTime} – ${outTime}`);
    }

    return formattedPairs.join(', ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <PencilLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Ajuste manual do dia
              </h3>
              <p className="text-xs text-slate-400">
                {formatFullDate(day.date)} • Jornada esperada: {formatMinutes(day.expectedMinutes)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Este ajuste substituirá os registros efetivos deste dia. Os registros anteriores serão preservados no histórico de auditoria.
            </span>
          </div>

          {/* Display Errors */}
          {(validationError || error) && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2" role="alert">
              <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{validationError || error}</span>
            </div>
          )}

          {/* Display Success */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2" aria-live="polite">
              <Clock3 className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form id="manual-adjustment-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Intervals List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Intervalos trabalhados
                </label>
                {intervals.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddInterval}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Adicionar intervalo</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {intervals.map((interval, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800"
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 w-24 shrink-0 font-mono">
                        Intervalo {index + 1}
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1">
                          <TimeInput
                            id={`clockIn-${index}`}
                            value={interval.clockIn}
                            onChange={(val) => handleIntervalChange(index, 'clockIn', val)}
                            required
                          />
                        </div>
                        <span className="text-slate-500 font-mono text-sm sm:pt-4">–</span>
                        <div className="flex-1">
                          <TimeInput
                            id={`clockOut-${index}`}
                            value={interval.clockOut}
                            onChange={(val) => handleIntervalChange(index, 'clockOut', val)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {intervals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInterval(index)}
                        className="self-end sm:self-center p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors mt-2 sm:mt-4"
                        aria-label={`Remover Intervalo ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reason Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="adjustment-reason" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Motivo do ajuste <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  {reason.length} / 500
                </span>
              </div>
              <textarea
                id="adjustment-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: esqueci de registrar a saída no horário correto."
                required
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </form>

          {/* Audit History Section */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Histórico de ajustes deste dia
              </h4>
            </div>

            {loadingAdjustments && (
              <p className="text-xs text-slate-500 py-2">Carregando histórico de auditoria...</p>
            )}

            {!loadingAdjustments && adjustments.length === 0 && (
              <p className="text-xs text-slate-500 italic py-2">
                Nenhum ajuste manual anterior gravado para esta data.
              </p>
            )}

            {!loadingAdjustments && adjustments.length > 0 && (
              <div className="space-y-3">
                {adjustments.map((adj) => {
                  const formattedDate = formatDateTime(adj.createdAt);

                  return (
                    <div
                      key={adj.id}
                      className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                        <span>{formattedDate}</span>
                      </div>

                      <p className="text-slate-200">
                        <strong className="text-slate-400 font-semibold">Motivo:</strong> {adj.reason}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                          <span className="text-rose-400 font-semibold block uppercase text-[10px] mb-0.5">
                            Antes:
                          </span>
                          <span className="text-slate-300">
                            {formatSnapshotIntervals(adj.beforeEntries)}
                          </span>
                        </div>

                        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                          <span className="text-emerald-400 font-semibold block uppercase text-[10px] mb-0.5">
                            Depois:
                          </span>
                          <span className="text-slate-300">
                            {formatSnapshotIntervals(adj.afterEntries)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700/80 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            <span>Cancelar</span>
          </button>

          <button
            type="submit"
            form="manual-adjustment-form"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar ajuste'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

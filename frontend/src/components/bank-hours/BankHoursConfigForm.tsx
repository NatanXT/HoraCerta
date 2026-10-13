import { useState, useEffect, FormEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { formatBalanceInput } from '../../utils/time';
import { AppDatePicker } from '../ui/AppDatePicker';

interface BankHoursConfigFormProps {
  initialStartDate?: string;
  initialBalanceMinutes?: number;
  todayStr: string;
  saving: boolean;
  onSave: (startDateStr: string, initialBalanceInputStr: string) => Promise<boolean>;
  onCancel?: () => void;
  isEditingExistingConfig?: boolean;
}

export function BankHoursConfigForm({
  initialStartDate,
  initialBalanceMinutes = 0,
  todayStr,
  saving,
  onSave,
  onCancel,
  isEditingExistingConfig = false,
}: BankHoursConfigFormProps) {
  const [startDate, setStartDate] = useState<string>(initialStartDate || todayStr);
  const [balanceInput, setBalanceInput] = useState<string>(
    formatBalanceInput(initialBalanceMinutes)
  );

  useEffect(() => {
    setStartDate(initialStartDate || todayStr);
    setBalanceInput(formatBalanceInput(initialBalanceMinutes));
  }, [initialStartDate, initialBalanceMinutes, todayStr]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave(startDate, balanceInput);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[var(--hc-text)] tracking-tight">
          Configuração da Apuração do Banco de Horas
        </h2>
        <p className="text-xs text-[var(--hc-text-secondary)] leading-relaxed">
          Escolha a data a partir da qual o HoraCerta deve começar a apurar seu banco de horas. Registros anteriores serão preservados no Histórico, mas ignorados na apuração acumulada.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Data Inicial */}
        <AppDatePicker
          id="startDateInput"
          label="Data inicial da apuração *"
          max={todayStr}
          required
          value={startDate}
          onChange={(val) => setStartDate(val)}
          disabled={saving}
        />

        {/* Saldo Inicial HH:MM */}
        <div className="space-y-1.5">
          <label htmlFor="initialBalanceInput" className="text-xs font-semibold text-[var(--hc-text-secondary)] block">
            Saldo inicial (HH:MM) <span className="text-rose-500">*</span>
          </label>
          <input
            id="initialBalanceInput"
            type="text"
            required
            placeholder="00:00"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            disabled={saving}
            className="w-full bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--hc-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hc-accent-soft)] focus:border-[var(--hc-accent)] transition-all font-mono"
          />
          <span className="text-[11px] text-[var(--hc-text-muted)] block">
            Exemplos: <code className="text-[var(--hc-text)] font-mono">00:00</code>, <code className="text-emerald-500 font-mono">+02:30</code>, <code className="text-amber-500 font-mono">-01:15</code>
          </span>
        </div>
      </div>

      {isEditingExistingConfig && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
          <span>Alterar a data inicial ou o saldo inicial recalcula o banco de horas. Seus registros de ponto não serão alterados.</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-[var(--hc-surface-raised)] hover:bg-[var(--hc-border)] text-[var(--hc-text)] text-sm font-semibold transition-colors cursor-pointer border border-[var(--hc-border)]"
          >
            Cancelar
          </button>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[var(--hc-accent)] hover:opacity-90 active:opacity-95 text-[var(--hc-accent-foreground)] text-sm font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-[var(--hc-accent-foreground)]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Salvando...</span>
            </>
          ) : (
            <span>Salvar configuração</span>
          )}
        </button>
      </div>
    </form>
  );
}

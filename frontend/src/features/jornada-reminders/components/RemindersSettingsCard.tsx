import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Clock,
  Coffee,
  LogOut,
  AlertTriangle,
  Send,
  Save,
  Check,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { ReminderSettings, BrowserPermissionState } from '../types';

interface RemindersSettingsCardProps {
  settings: ReminderSettings;
  permission: BrowserPermissionState;
  onSave: (settings: ReminderSettings) => boolean | void;
  onRequestPermission: () => Promise<BrowserPermissionState>;
  onTestReminder: () => void;
}

export const RemindersSettingsCard: React.FC<RemindersSettingsCardProps> = ({
  settings: initialSettings,
  permission,
  onSave,
  onRequestPermission,
  onTestReminder,
}) => {
  const [form, setForm] = useState<ReminderSettings>(initialSettings);
  const [isDirty, setIsDirty] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [requestingPerm, setRequestingPerm] = useState(false);
  const prevInitialSettingsRef = useRef<string>(JSON.stringify(initialSettings));

  // Synchronize form when user or context settings change, preserving unsaved local edits
  useEffect(() => {
    const currentJson = JSON.stringify(initialSettings);
    const hasExternalChanged = currentJson !== prevInitialSettingsRef.current;
    prevInitialSettingsRef.current = currentJson;

    // Only overwrite local form if user hasn't made unsaved modifications or settings changed externally
    if (!isDirty || hasExternalChanged) {
      setForm(initialSettings);
      setIsDirty(false);
    }
  }, [initialSettings, isDirty]);

  const handleChange = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSavedSuccess(false);
    setStorageWarning(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onSave(form);
    if (result === false) {
      setStorageWarning(
        'Aviso: O armazenamento local deste navegador não está disponível. Suas preferências serão mantidas nesta aba durante a sessão atual, mas não serão persistidas após o fechamento.'
      );
      setSavedSuccess(false);
    } else {
      setIsDirty(false);
      prevInitialSettingsRef.current = JSON.stringify(form);
      setSavedSuccess(true);
      setStorageWarning(null);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const handleRequestPermissionClick = async () => {
    setRequestingPerm(true);
    try {
      const res = await onRequestPermission();
      if (res === 'granted') {
        handleChange('browserNotificationsEnabled', true);
      }
    } finally {
      setRequestingPerm(false);
    }
  };

  const handleNativeToggle = async (checked: boolean) => {
    if (checked && permission === 'default') {
      setRequestingPerm(true);
      try {
        const res = await onRequestPermission();
        if (res === 'granted') {
          handleChange('browserNotificationsEnabled', true);
        } else {
          handleChange('browserNotificationsEnabled', false);
        }
      } finally {
        setRequestingPerm(false);
      }
    } else {
      handleChange('browserNotificationsEnabled', checked);
    }
  };

  const getPermissionLabel = () => {
    switch (permission) {
      case 'granted':
        return {
          text: 'Autorizadas no navegador',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          desc: 'Permissão concedida. Ative a opção abaixo caso deseje receber avisos quando esta aba estiver em segundo plano.',
        };
      case 'denied':
        return {
          text: 'Bloqueadas pelo navegador',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          desc: 'As notificações foram bloqueadas nas configurações do navegador. Desbloqueie o site nas configurações do navegador se desejar avisos nativos.',
        };
      case 'unsupported':
        return {
          text: 'Não suportadas',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          desc: 'Este navegador não oferece suporte à Notifications API. Os lembretes visuais internos continuarão funcionando normalmente.',
        };
      default:
        return {
          text: 'Não solicitadas',
          color: 'text-[var(--hc-text-secondary)] bg-[var(--hc-surface-raised)] border-[var(--hc-border)]',
          desc: 'Permissão pendente. Clique no botão abaixo para autorizar avisos quando a aba estiver em segundo plano.',
        };
    }
  };

  const permStatus = getPermissionLabel();

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Master Toggle Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--hc-accent-soft)] border border-[var(--hc-accent-border)] text-[var(--hc-accent)] shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--hc-text)] tracking-tight">
                Lembretes inteligentes de jornada
              </h3>
              <p className="text-xs text-[var(--hc-text-secondary)] mt-0.5">
                Receba avisos contextuais baseados no seu horário previsto e nos registros reais de
                ponto.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="sr-only peer"
              aria-label="Ativar lembretes inteligentes de jornada"
            />
            <div className="w-11 h-6 bg-[var(--hc-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--hc-accent)]"></div>
            <span className="ml-3 text-xs font-semibold text-[var(--hc-text)] select-none">
              {form.enabled ? 'Ativado' : 'Desativado'}
            </span>
          </label>
        </div>

        {form.enabled && (
          <div className="p-3 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] text-xs text-[var(--hc-text-secondary)] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--hc-accent)] shrink-0" />
            <span>
              Lembretes são recalculados em tempo real e não alteram nenhuma marcação de ponto nem o
              banco de horas.
            </span>
          </div>
        )}
      </div>

      {/* Detail Options (Semantically disabled via fieldset if master is off) */}
      <fieldset
        disabled={!form.enabled}
        className={`border-0 p-0 m-0 ${!form.enabled ? 'opacity-50' : ''}`}
      >
        <div className="p-5 sm:p-6 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-sm space-y-5">
          <legend className="text-xs font-bold uppercase tracking-wider text-[var(--hc-text-muted)] float-none">
            Tipos de lembrete e antecedência
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* 1. Entrada */}
            <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold text-[var(--hc-text)]">
                    Lembrar horário de entrada
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.entryEnabled}
                  onChange={(e) => handleChange('entryEnabled', e.target.checked)}
                  disabled={!form.enabled}
                  className="w-4 h-4 accent-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-[var(--hc-text-secondary)]">
                Avisa antes do horário nominal de início caso nenhuma entrada tenha sido registrada.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[11px] text-[var(--hc-text-muted)] whitespace-nowrap">
                  Antecedência:
                </label>
                <select
                  value={form.entryLeadMinutes}
                  onChange={(e) => handleChange('entryLeadMinutes', Number(e.target.value))}
                  disabled={!form.enabled || !form.entryEnabled}
                  className="text-xs py-1 px-2.5 rounded-lg bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] focus:outline-none focus:border-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value={0}>Na hora exata (0 min)</option>
                  <option value={5}>5 minutos antes</option>
                  <option value={10}>10 minutos antes</option>
                  <option value={15}>15 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                </select>
              </div>
            </div>

            {/* 2. Retorno do intervalo */}
            <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-[var(--hc-text)]">
                    Lembrar retorno do intervalo
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.breakEnabled}
                  onChange={(e) => handleChange('breakEnabled', e.target.checked)}
                  disabled={!form.enabled}
                  className="w-4 h-4 accent-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-[var(--hc-text-secondary)]">
                Avisa antes do fim planejado da pausa para almoço ou lanche ativo.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[11px] text-[var(--hc-text-muted)] whitespace-nowrap">
                  Antecedência:
                </label>
                <select
                  value={form.breakLeadMinutes}
                  onChange={(e) => handleChange('breakLeadMinutes', Number(e.target.value))}
                  disabled={!form.enabled || !form.breakEnabled}
                  className="text-xs py-1 px-2.5 rounded-lg bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] focus:outline-none focus:border-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value={0}>Na hora exata (0 min)</option>
                  <option value={5}>5 minutos antes</option>
                  <option value={10}>10 minutos antes</option>
                  <option value={15}>15 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                </select>
              </div>
            </div>

            {/* 3. Saída prevista */}
            <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LogOut className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-[var(--hc-text)]">
                    Lembrar saída prevista
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.exitEnabled}
                  onChange={(e) => handleChange('exitEnabled', e.target.checked)}
                  disabled={!form.enabled}
                  className="w-4 h-4 accent-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-[var(--hc-text-secondary)]">
                Calcula a previsão de término com base na entrada e tempo trabalhado real.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[11px] text-[var(--hc-text-muted)] whitespace-nowrap">
                  Antecedência:
                </label>
                <select
                  value={form.exitLeadMinutes}
                  onChange={(e) => handleChange('exitLeadMinutes', Number(e.target.value))}
                  disabled={!form.enabled || !form.exitEnabled}
                  className="text-xs py-1 px-2.5 rounded-lg bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] focus:outline-none focus:border-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value={0}>Na hora exata (0 min)</option>
                  <option value={5}>5 minutos antes</option>
                  <option value={10}>10 minutos antes</option>
                  <option value={15}>15 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                </select>
              </div>
            </div>

            {/* 4. Jornada prolongada */}
            <div className="p-4 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs font-bold text-[var(--hc-text)]">
                    Alerta de jornada prolongada
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={form.overtimeEnabled}
                  onChange={(e) => handleChange('overtimeEnabled', e.target.checked)}
                  disabled={!form.enabled}
                  className="w-4 h-4 accent-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-[var(--hc-text-secondary)]">
                Alerta preventivo se o expediente continuar em aberto após o horário previsto.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[11px] text-[var(--hc-text-muted)] whitespace-nowrap">
                  Tolerância:
                </label>
                <select
                  value={form.overtimeToleranceMinutes}
                  onChange={(e) => handleChange('overtimeToleranceMinutes', Number(e.target.value))}
                  disabled={!form.enabled || !form.overtimeEnabled}
                  className="text-xs py-1 px-2.5 rounded-lg bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] focus:outline-none focus:border-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value={30}>30 minutos após previsto</option>
                  <option value={60}>60 minutos após previsto</option>
                  <option value={90}>90 minutos após previsto</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      {/* Browser Notifications Section (Clear separation between permission and user preference) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--hc-surface)] border border-[var(--hc-border)] shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--hc-text-muted)]">
                Notificações nativas do navegador
              </h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${permStatus.color}`}>
                {permStatus.text}
              </span>
            </div>
            <p className="text-xs text-[var(--hc-text-secondary)]">{permStatus.desc}</p>
          </div>
        </div>

        {/* User Opt-In Toggle */}
        <div className="p-3.5 rounded-xl bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label
              htmlFor="native-toggle"
              className="text-xs font-bold text-[var(--hc-text)] cursor-pointer"
            >
              Exibir notificações nativas fora da aba ativa
            </label>
            <p className="text-[11px] text-[var(--hc-text-secondary)]">
              Envia aviso do sistema operacional quando o navegador estiver minimizado ou em outra aba.
            </p>
          </div>
          <input
            id="native-toggle"
            type="checkbox"
            checked={form.browserNotificationsEnabled}
            onChange={(e) => handleNativeToggle(e.target.checked)}
            disabled={!form.enabled || permission === 'denied' || permission === 'unsupported'}
            className="w-4 h-4 accent-[var(--hc-accent)] cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        {permission !== 'granted' && permission !== 'unsupported' && (
          <div>
            <button
              type="button"
              onClick={handleRequestPermissionClick}
              disabled={requestingPerm || permission === 'denied'}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--hc-surface-raised)] border border-[var(--hc-border)] hover:border-[var(--hc-accent-border)] text-[var(--hc-text)] hover:text-[var(--hc-accent)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Bell className="w-3.5 h-3.5 text-[var(--hc-accent)]" />
              <span>{requestingPerm ? 'Aguardando autorização...' : 'Solicitar permissão no navegador'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Storage Warning Banner (if local storage failed) */}
      {storageWarning && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{storageWarning}</span>
        </div>
      )}

      {/* Action Footer: Save and Test Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onTestReminder}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--hc-surface)] border border-[var(--hc-border)] hover:border-[var(--hc-accent-border)] text-[var(--hc-text)] hover:bg-[var(--hc-surface-raised)] transition-all cursor-pointer"
        >
          <Send className="w-4 h-4 text-[var(--hc-accent)]" />
          <span>Testar lembrete demonstrativo</span>
        </button>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 animate-in fade-in">
              <Check className="w-4 h-4" />
              Preferências salvas com sucesso!
            </span>
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--hc-accent)] text-[var(--hc-accent-foreground)] hover:brightness-110 shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar preferências</span>
          </button>
        </div>
      </div>
    </form>
  );
};

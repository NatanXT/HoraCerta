import React, { useState, useEffect } from 'react';
import { Save, UserRound, Mail, Globe, CheckCircle2, AlertTriangle } from 'lucide-react';
import { SettingsProfile } from '../../types/settings';

interface ProfileSettingsProps {
  profile: SettingsProfile;
  timezone: string;
  loading: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  onSave: (name: string) => Promise<boolean>;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  profile,
  timezone,
  loading,
  successMessage,
  errorMessage,
  onSave,
}) => {
  const [name, setName] = useState(profile.name);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setValidationError('Nome deve ter no mínimo 2 caracteres.');
      return;
    }
    if (trimmed.length > 100) {
      setValidationError('Nome deve ter no máximo 100 caracteres.');
      return;
    }

    setValidationError(null);
    await onSave(trimmed);
  };

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700/60 p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-700/60">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
          <UserRound className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Informações básicas</h2>
          <p className="text-sm text-slate-400">
            Visualize e atualize os seus dados de identificação e preferências gerais.
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-slate-300 mb-1.5">
            Nome
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-colors"
            placeholder="Seu nome completo"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-slate-300 mb-1.5">
            E-mail
          </label>
          <div className="relative">
            <input
              id="profile-email"
              type="email"
              value={profile.email}
              readOnly
              disabled
              className="w-full px-3.5 py-2.5 bg-slate-900/40 border border-slate-700/50 rounded-lg text-slate-400 text-sm cursor-not-allowed pr-28"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              Somente leitura
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="profile-timezone" className="block text-sm font-medium text-slate-300 mb-1.5">
            Fuso horário
          </label>
          <div className="relative">
            <input
              id="profile-timezone"
              type="text"
              value={timezone}
              readOnly
              disabled
              className="w-full px-3.5 py-2.5 bg-slate-900/40 border border-slate-700/50 rounded-lg text-slate-400 text-sm cursor-not-allowed pr-28"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Somente leitura
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Utilizado para calcular corretamente seus registros de ponto.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Salvando...' : 'Salvar informações'}</span>
          </button>
        </div>
      </form>
    </section>
  );
};

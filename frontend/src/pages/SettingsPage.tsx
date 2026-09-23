import React from 'react';
import { Settings, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { WorkScheduleSettings } from '../components/settings/WorkScheduleSettings';

import { WorkScheduleDay } from '../types/settings';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    loading,
    error,
    saveProfileLoading,
    saveScheduleLoading,
    profileSuccessMessage,
    profileErrorMessage,
    scheduleSuccessMessage,
    scheduleErrorMessage,
    fetchSettings,
    updateProfile,
    updateWorkSchedule,
  } = useSettings();

  const handleSaveProfile = async (name: string) => {
    return updateProfile({ name });
  };

  const handleSaveWorkSchedule = async (days: WorkScheduleDay[]) => {
    return updateWorkSchedule({ days });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Settings className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Configurações</h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Gerencie seu perfil e personalize sua jornada de trabalho semanal.
          </p>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={fetchSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {loading && !settings ? (
        <div className="space-y-6">
          <div className="h-64 bg-slate-800/60 rounded-xl animate-pulse border border-slate-700/40" />
          <div className="h-96 bg-slate-800/60 rounded-xl animate-pulse border border-slate-700/40" />
        </div>
      ) : settings ? (
        <div className="space-y-8">
          <ProfileSettings
            profile={settings.profile}
            timezone={settings.preferences.timezone}
            loading={saveProfileLoading}
            successMessage={profileSuccessMessage}
            errorMessage={profileErrorMessage}
            onSave={handleSaveProfile}
          />

          <WorkScheduleSettings
            days={settings.workSchedule.days}
            loading={saveScheduleLoading}
            successMessage={scheduleSuccessMessage}
            errorMessage={scheduleErrorMessage}
            onSave={handleSaveWorkSchedule}
          />
        </div>
      ) : null}
    </div>
  );
};

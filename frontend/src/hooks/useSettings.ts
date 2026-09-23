import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { settingsService } from '../services/settings.service';
import {
  SettingsResponse,
  SaveProfilePayload,
  SaveWorkSchedulePayload,
} from '../types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [saveProfileLoading, setSaveProfileLoading] = useState<boolean>(false);
  const [saveScheduleLoading, setSaveScheduleLoading] = useState<boolean>(false);

  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);

  const [scheduleSuccessMessage, setScheduleSuccessMessage] = useState<string | null>(null);
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState<string | null>(null);

  const isSavingProfileRef = useRef<boolean>(false);
  const isSavingScheduleRef = useRef<boolean>(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && !err.response) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
      } else if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError('Erro ao carregar configurações.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateProfile = async (payload: SaveProfilePayload): Promise<boolean> => {
    if (isSavingProfileRef.current) return false;
    isSavingProfileRef.current = true;
    setSaveProfileLoading(true);
    setProfileSuccessMessage(null);
    setProfileErrorMessage(null);

    try {
      const updatedProfile = await settingsService.saveProfile(payload);
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              profile: updatedProfile,
            }
          : null
      );
      setProfileSuccessMessage('Informações básicas atualizadas com sucesso.');
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        setProfileErrorMessage(err.response.data.error.message);
      } else {
        setProfileErrorMessage('Erro ao atualizar informações básicas.');
      }
      return false;
    } finally {
      isSavingProfileRef.current = false;
      setSaveProfileLoading(false);
    }
  };

  const updateWorkSchedule = async (payload: SaveWorkSchedulePayload): Promise<boolean> => {
    if (isSavingScheduleRef.current) return false;
    isSavingScheduleRef.current = true;
    setSaveScheduleLoading(true);
    setScheduleSuccessMessage(null);
    setScheduleErrorMessage(null);

    try {
      const updatedSettings = await settingsService.saveWorkSchedule(payload);
      setSettings(updatedSettings);
      setScheduleSuccessMessage('Jornada atualizada com sucesso.');
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        setScheduleErrorMessage(err.response.data.error.message);
      } else {
        setScheduleErrorMessage('Erro ao atualizar jornada semanal.');
      }
      return false;
    } finally {
      isSavingScheduleRef.current = false;
      setSaveScheduleLoading(false);
    }
  };

  const clearMessages = () => {
    setProfileSuccessMessage(null);
    setProfileErrorMessage(null);
    setScheduleSuccessMessage(null);
    setScheduleErrorMessage(null);
  };

  return {
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
    clearMessages,
  };
}

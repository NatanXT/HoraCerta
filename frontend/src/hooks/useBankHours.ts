import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { BankHoursResponse } from '../types/bank-hours';
import { bankHoursService } from '../services/bank-hours.service';
import { parseBalanceInput } from '../utils/time';
import { getTodayDateStr } from '../utils/date';

export interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

export function useBankHours() {
  const todayStr = getTodayDateStr();

  const [data, setData] = useState<BankHoursResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState<boolean>(false);

  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionInFlightRef = useRef<boolean>(false);

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback({ type, message });
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 4000);
  }, []);

  const fetchBankHours = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await bankHoursService.getBankHours();
      setData(res);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && !err.response) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
      } else {
        setError('Não foi possível carregar o banco de horas.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBankHours();
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [fetchBankHours]);

  const saveConfig = async (startDateStr: string, initialBalanceInputStr: string): Promise<boolean> => {
    if (actionInFlightRef.current) return false;

    if (!startDateStr) {
      showFeedback('error', 'Por favor, selecione uma data inicial.');
      return false;
    }

    if (startDateStr > todayStr) {
      showFeedback('error', 'A data inicial da apuração não pode ser futura.');
      return false;
    }

    const initialBalanceMinutes = parseBalanceInput(initialBalanceInputStr);
    if (initialBalanceMinutes === null) {
      showFeedback(
        'error',
        'Formato de saldo inicial inválido. Utilize o formato HH:MM (ex: 00:00, +02:30, -01:15).'
      );
      return false;
    }

    actionInFlightRef.current = true;
    setSaving(true);

    try {
      const updatedData = await bankHoursService.saveBankHoursConfig({
        startDate: startDateStr,
        initialBalanceMinutes,
      });
      setData(updatedData);
      setIsEditingConfig(false);
      showFeedback('success', 'Configuração do banco de horas salva com sucesso!');
      return true;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const apiMsg = err.response?.data?.error?.message;
        showFeedback('error', apiMsg || 'Erro ao salvar configuração do banco de horas.');
      } else {
        showFeedback('error', 'Erro ao salvar configuração do banco de horas.');
      }
      return false;
    } finally {
      setSaving(false);
      actionInFlightRef.current = false;
    }
  };

  const toggleEditConfig = () => {
    setIsEditingConfig((prev) => !prev);
  };

  return {
    data,
    loading,
    saving,
    error,
    feedback,
    isEditingConfig,
    todayStr,
    saveConfig,
    toggleEditConfig,
    retry: fetchBankHours,
  };
}

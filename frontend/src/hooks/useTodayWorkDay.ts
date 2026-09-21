import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { WorkDaySummary } from '../types/work-day';
import { workDayService } from '../services/work-day.service';
import { timeEntryService } from '../services/time-entry.service';

export interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

export function useTodayWorkDay() {
  const [data, setData] = useState<WorkDaySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

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

  const fetchToday = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) {
        setLoading(true);
      }
      const summary = await workDayService.getTodayWorkDay();
      setData(summary);
      setError(null);
    } catch (err: unknown) {
      if (!isPolling) {
        if (axios.isAxiosError(err) && !err.response) {
          setError('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
        } else {
          setError('Erro ao carregar dados da jornada.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday(false);

    // Light polling every 30 seconds
    const interval = setInterval(() => {
      fetchToday(true);
    }, 30000);

    return () => {
      clearInterval(interval);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [fetchToday]);

  const handleClockIn = async () => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setSubmitting(true);

    try {
      const updatedSummary = await timeEntryService.clockIn();
      setData(updatedSummary);
      showFeedback('success', 'Entrada registrada com sucesso!');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          showFeedback(
            'error',
            'Não foi possível registrar a entrada porque o estado atual mudou. Atualizamos os dados para você.'
          );
          fetchToday(true);
        } else if (!err.response) {
          showFeedback('error', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
        } else {
          const apiMsg = err.response.data?.error?.message;
          showFeedback('error', apiMsg || 'Erro ao registrar entrada.');
        }
      } else {
        showFeedback('error', 'Erro ao registrar entrada.');
      }
    } finally {
      setSubmitting(false);
      actionInFlightRef.current = false;
    }
  };

  const handleClockOut = async () => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setSubmitting(true);

    try {
      const updatedSummary = await timeEntryService.clockOut();
      setData(updatedSummary);
      showFeedback('success', 'Saída registrada com sucesso!');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          showFeedback(
            'error',
            'Não foi possível registrar a saída porque o estado atual mudou. Atualizamos os dados para você.'
          );
          fetchToday(true);
        } else if (!err.response) {
          showFeedback('error', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
        } else {
          const apiMsg = err.response.data?.error?.message;
          showFeedback('error', apiMsg || 'Erro ao registrar saída.');
        }
      } else {
        showFeedback('error', 'Erro ao registrar saída.');
      }
    } finally {
      setSubmitting(false);
      actionInFlightRef.current = false;
    }
  };

  return {
    data,
    loading,
    submitting,
    error,
    feedback,
    fetchToday: () => fetchToday(false),
    handleClockIn,
    handleClockOut,
  };
}

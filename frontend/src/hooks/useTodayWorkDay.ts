import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { workSessionService, WorkDayWithSession } from '../services/work-session.service';

export interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

export function useTodayWorkDay() {
  const [data, setData] = useState<WorkDayWithSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionInFlightRef = useRef<boolean>(false);
  const reconcileDispatchedRef = useRef<boolean>(false);

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
      const summary = await workSessionService.getToday();
      setData(summary);
      setError(null);
    } catch (err: unknown) {
      if (!isPolling) {
        if (axios.isAxiosError(err) && !err.response) {
          setError('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
        } else {
          const apiMsg = axios.isAxiosError(err) ? (err.response?.data?.error?.message || err.response?.data?.message) : null;
          setError(apiMsg || 'Erro ao carregar dados da jornada.');
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

  const handleReconcile = useCallback(async () => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setSubmitting(true);
    try {
      const updated = await workSessionService.reconcileSession();
      setData(updated || (await workSessionService.getToday()));
    } catch (err: unknown) {
      showFeedback('error', 'Não foi possível sincronizar o retorno automático.');
    } finally {
      setSubmitting(false);
      actionInFlightRef.current = false;
    }
  }, [showFeedback]);

  // Automatically trigger reconcile exactly once when reconciliationRequired is flagged by backend
  useEffect(() => {
    if (data?.session?.reconciliationRequired) {
      if (!reconcileDispatchedRef.current && !actionInFlightRef.current) {
        reconcileDispatchedRef.current = true;
        handleReconcile();
      }
    } else {
      reconcileDispatchedRef.current = false;
    }
  }, [data?.session?.reconciliationRequired, handleReconcile]);

  const executeAction = async (
    actionFn: () => Promise<WorkDayWithSession>,
    successMsg: string,
    errorDefaultMsg: string
  ) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setSubmitting(true);

    try {
      const updatedSummary = await actionFn();
      setData(updatedSummary || (await workSessionService.getToday()));
      showFeedback('success', successMsg);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const apiMsg = err.response?.data?.error?.message || err.response?.data?.message;
        if (err.response?.status === 409) {
          showFeedback(
            'error',
            apiMsg || 'Conflito de estado do expediente. Atualizamos os dados para você.'
          );
        } else if (!err.response) {
          showFeedback('error', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
        } else {
          showFeedback('error', apiMsg || errorDefaultMsg);
        }
      } else {
        showFeedback('error', errorDefaultMsg);
      }
      // Always re-sync state with server after an action error
      await fetchToday(true);
    } finally {
      setSubmitting(false);
      actionInFlightRef.current = false;
    }
  };

  const handleStart = () =>
    executeAction(
      () => workSessionService.startSession(),
      'Expediente iniciado com sucesso!',
      'Erro ao iniciar expediente.'
    );

  const handlePauseSnack = () =>
    executeAction(
      () => workSessionService.pauseSession('SNACK'),
      'Pausa para lanche iniciada.',
      'Erro ao iniciar pausa de lanche.'
    );

  const handlePauseLunch = () =>
    executeAction(
      () => workSessionService.pauseSession('LUNCH'),
      'Pausa para almoço iniciada.',
      'Erro ao iniciar pausa de almoço.'
    );

  const handleResume = () =>
    executeAction(
      () => workSessionService.resumeSession(),
      'Expediente retomado!',
      'Erro ao retomar expediente.'
    );

  const handleFinish = () =>
    executeAction(
      () => workSessionService.finishSession(),
      'Expediente encerrado com sucesso.',
      'Erro ao encerrar expediente.'
    );

  return {
    data,
    loading,
    submitting,
    error,
    feedback,
    fetchToday: () => fetchToday(false),
    handleStart,
    handlePauseSnack,
    handlePauseLunch,
    handleResume,
    handleFinish,
    handleReconcile,
  };
}

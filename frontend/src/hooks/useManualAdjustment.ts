import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { manualAdjustmentService } from '../services/manual-adjustment.service';
import {
  ManualAdjustmentPayload,
  ManualAdjustmentResponse,
  WorkDayAdjustment,
} from '../types/manual-adjustment';

export function useManualAdjustment() {
  const [adjustments, setAdjustments] = useState<WorkDayAdjustment[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSubmittingRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(0);

  const fetchAdjustments = useCallback(async (date: string) => {
    const currentRequestId = ++requestIdRef.current;
    setLoadingAdjustments(true);
    setError(null);

    try {
      const res = await manualAdjustmentService.getAdjustments(date);
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      setAdjustments(res.adjustments);
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Erro ao carregar histórico de ajustes.';
      setError(msg);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoadingAdjustments(false);
      }
    }
  }, []);

  const submitAdjustment = useCallback(
    async (
      date: string,
      payload: ManualAdjustmentPayload
    ): Promise<ManualAdjustmentResponse | null> => {
      if (isSubmittingRef.current) {
        return null;
      }

      isSubmittingRef.current = true;
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await manualAdjustmentService.saveAdjustment(date, payload);
        setSuccessMessage('Ajuste manual salvo com sucesso!');
        await fetchAdjustments(date);
        return response;
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.error?.message
            ? err.response.data.error.message
            : 'Não foi possível salvar o ajuste manual.';
        setError(msg);
        return null;
      } finally {
        setSaving(false);
        isSubmittingRef.current = false;
      }
    },
    [fetchAdjustments]
  );

  const clearFeedback = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    adjustments,
    loadingAdjustments,
    saving,
    error,
    successMessage,
    fetchAdjustments,
    submitAdjustment,
    clearFeedback,
  };
}

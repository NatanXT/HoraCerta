import { useState, useCallback, useRef } from 'react';
import {
  CalendarOccurrence,
  CreateCalendarOccurrenceInput,
  UpdateCalendarOccurrenceInput,
} from '../types/calendar-occurrence';
import { calendarOccurrenceService } from '../services/calendar-occurrence.service';

export function useCalendarOccurrences(_monthStr?: string) {
  const [occurrences, setOccurrences] = useState<CalendarOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Stale request protection
  const latestRequestIdRef = useRef(0);
  // Double-submit protection
  const isSubmittingRef = useRef(false);

  const fetchOccurrences = useCallback(async (fromStr: string, toStr: string) => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await calendarOccurrenceService.getOccurrences(fromStr, toStr);
      // Ignore if a newer request was dispatched
      if (requestId === latestRequestIdRef.current) {
        setOccurrences(data);
      }
    } catch (err: any) {
      if (requestId === latestRequestIdRef.current) {
        const msg = err.response?.data?.message || 'Erro ao carregar ocorrências.';
        setError(msg);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const createOccurrence = async (input: CreateCalendarOccurrenceInput): Promise<boolean> => {
    if (isSubmittingRef.current) return false;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await calendarOccurrenceService.createOccurrence(input);
      setSuccessMessage('Ocorrência salva com sucesso!');
      return true;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao criar ocorrência.';
      setError(msg);
      return false;
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const updateOccurrence = async (
    id: string,
    input: UpdateCalendarOccurrenceInput
  ): Promise<boolean> => {
    if (isSubmittingRef.current) return false;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await calendarOccurrenceService.updateOccurrence(id, input);
      setSuccessMessage('Ocorrência atualizada com sucesso!');
      return true;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao atualizar ocorrência.';
      setError(msg);
      return false;
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const deleteOccurrence = async (id: string): Promise<boolean> => {
    if (isSubmittingRef.current) return false;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await calendarOccurrenceService.deleteOccurrence(id);
      setSuccessMessage('Ocorrência removida com sucesso!');
      return true;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erro ao remover ocorrência.';
      setError(msg);
      return false;
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  return {
    occurrences,
    loading,
    submitting,
    error,
    successMessage,
    setError,
    setSuccessMessage,
    fetchOccurrences,
    createOccurrence,
    updateOccurrence,
    deleteOccurrence,
  };
}

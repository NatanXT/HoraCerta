import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WeeklySummaryResponse } from '../types/weekly-summary';
import { workDayService } from '../services/work-day.service';
import { getTodayDateStr, getWeekDateRange, shiftWeek } from '../utils/date';

interface UseWeeklySummaryOptions {
  refreshTrigger?: unknown;
}

interface DataEnvelope {
  userId: string;
  mondayStr: string;
  response: WeeklySummaryResponse;
}

export function useWeeklySummary({ refreshTrigger }: UseWeeklySummaryOptions = {}) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const currentUserIdRef = useRef<string | undefined>(currentUserId);
  currentUserIdRef.current = currentUserId;

  const todayStr = getTodayDateStr();
  const currentMondayStr = getWeekDateRange(todayStr).mondayStr;

  const [selectedMondayStr, setSelectedMondayStr] = useState<string>(currentMondayStr);
  const selectedMondayStrRef = useRef<string>(currentMondayStr);
  selectedMondayStrRef.current = selectedMondayStr;

  const prevUserIdRef = useRef<string | undefined>(currentUserId);

  const [dataEnvelope, setDataEnvelope] = useState<DataEnvelope | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);
  const isCurrentWeekSelected = selectedMondayStr === currentMondayStr;

  const hasMountedRef = useRef<boolean>(false);
  const prevRefreshTriggerRef = useRef<unknown>(refreshTrigger);

  // Adjust state synchronously during render when user identity changes
  if (prevUserIdRef.current !== currentUserId) {
    prevUserIdRef.current = currentUserId;
    requestIdRef.current += 1;
    selectedMondayStrRef.current = currentMondayStr;
    setSelectedMondayStr(currentMondayStr);
    setDataEnvelope(null);
    setError(null);
    setLoading(currentUserId !== undefined);
    hasMountedRef.current = false;
  }

  // Strict synchronous isolation guard:
  // Data is rendered ONLY when it belongs to the current authenticated user AND the selected week.
  const isDataForCurrentContext =
    dataEnvelope !== null &&
    currentUserId !== undefined &&
    dataEnvelope.userId === currentUserId &&
    dataEnvelope.mondayStr === selectedMondayStr;

  const data = isDataForCurrentContext ? dataEnvelope.response : null;
  const isStale =
    dataEnvelope !== null &&
    dataEnvelope.userId === currentUserId &&
    dataEnvelope.mondayStr !== selectedMondayStr;

  // Invalidate any in-flight requests on unmount
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  const fetchSummary = useCallback(
    async (mondayToFetch: string) => {
      const requestUserId = currentUserIdRef.current;
      if (!requestUserId) {
        setLoading(false);
        setDataEnvelope(null);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const response = await workDayService.getWeeklySummary(mondayToFetch);

        // Guard against stale response from previous user, out-of-order responses, or changed week
        if (
          currentRequestId !== requestIdRef.current ||
          currentUserIdRef.current !== requestUserId ||
          selectedMondayStrRef.current !== mondayToFetch
        ) {
          return;
        }

        setDataEnvelope({
          userId: requestUserId,
          mondayStr: mondayToFetch,
          response,
        });
      } catch (err: any) {
        if (
          currentRequestId !== requestIdRef.current ||
          currentUserIdRef.current !== requestUserId ||
          selectedMondayStrRef.current !== mondayToFetch
        ) {
          return;
        }
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Não foi possível carregar o resumo semanal. Verifique sua conexão e tente novamente.'
        );
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // 1. Fetch whenever selectedMondayStr or user changes
  useEffect(() => {
    fetchSummary(selectedMondayStr);
  }, [selectedMondayStr, currentUserId, fetchSummary]);

  // 2. Fetch on subsequent mutation triggers (e.g. clock-in/pause/finish) for the current week only
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevRefreshTriggerRef.current = refreshTrigger;
      return;
    }

    if (prevRefreshTriggerRef.current !== refreshTrigger) {
      prevRefreshTriggerRef.current = refreshTrigger;
      if (isCurrentWeekSelected) {
        fetchSummary(selectedMondayStr);
      }
    }
  }, [refreshTrigger, isCurrentWeekSelected, selectedMondayStr, fetchSummary]);

  const goToPreviousWeek = useCallback(() => {
    setSelectedMondayStr((prev) => {
      const next = shiftWeek(prev, -1);
      selectedMondayStrRef.current = next;
      return next;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setSelectedMondayStr((prev) => {
      const next = shiftWeek(prev, 1);
      selectedMondayStrRef.current = next;
      return next;
    });
  }, []);

  const goToCurrentWeek = useCallback(() => {
    selectedMondayStrRef.current = currentMondayStr;
    setSelectedMondayStr(currentMondayStr);
  }, [currentMondayStr]);

  return {
    selectedMondayStr,
    data,
    loading,
    isStale,
    error,
    isCurrentWeekSelected,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    retry: () => fetchSummary(selectedMondayStrRef.current),
    refresh: () => fetchSummary(selectedMondayStrRef.current),
  };
}

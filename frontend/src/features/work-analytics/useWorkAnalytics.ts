import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { getTodayDateStr } from '../../utils/date';
import { workDayService } from '../../services/work-day.service';
import { bankHoursService } from '../../services/bank-hours.service';
import { MonthlyDaySummary, MonthlyHistoryResponse } from '../../types/work-day';
import { BankHoursResponse } from '../../types/bank-hours';
import {
  AnalyticsPeriodPreset,
  AnalyticsDateRange,
  WorkAnalyticsData,
} from './types';
import {
  getPresetRange,
  getMonthsBetween,
  validateCustomRange,
  getDaysInMonth,
  isValidCivilDate,
  aggregateWorkAnalytics,
} from './analytics-calculator';

export interface UseWorkAnalyticsResult {
  preset: AnalyticsPeriodPreset;
  range: AnalyticsDateRange;
  data: WorkAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refreshError: string | null;
  isStale: boolean;
  warning: string | null;
  customStartDate: string;
  customEndDate: string;
  customError: string | null;
  setCustomStartDate: (val: string) => void;
  setCustomEndDate: (val: string) => void;
  selectPreset: (preset: AnalyticsPeriodPreset) => void;
  applyCustomRange: () => boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

interface LoadedState {
  userId: string;
  range: AnalyticsDateRange;
  days: MonthlyDaySummary[];
  bankHours: BankHoursResponse | null;
  bankHoursStatus: 'configured' | 'unconfigured' | 'error';
  failedMonths: string[];
  partialMonths: string[];
}

export function useWorkAnalytics(): UseWorkAnalyticsResult {
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const todayStr = getTodayDateStr();

  const initialRange = useMemo(() => getPresetRange('current-month', todayStr), [todayStr]);

  const [preset, setPreset] = useState<AnalyticsPeriodPreset>('current-month');
  const [range, setRange] = useState<AnalyticsDateRange>(initialRange);

  const [customStartDate, setCustomStartDate] = useState<string>(initialRange.startDate);
  const [customEndDate, setCustomEndDate] = useState<string>(initialRange.endDate);
  const [customError, setCustomError] = useState<string | null>(null);

  const [loadedState, setLoadedState] = useState<LoadedState | null>(null);
  const loadedStateRef = useRef<LoadedState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  const requestIdRef = useRef<number>(0);
  const activeUserIdRef = useRef<string>(currentUserId);

  // Synchronous reset on user switch or logout
  if (activeUserIdRef.current !== currentUserId) {
    activeUserIdRef.current = currentUserId;
    requestIdRef.current++;
    loadedStateRef.current = null;
    setLoadedState(null);
    setError(null);
    setRefreshError(null);
    setIsStale(false);
  }

  const fetchAnalytics = useCallback(
    async (targetRange: AnalyticsDateRange) => {
      if (!currentUserId) {
        loadedStateRef.current = null;
        setLoadedState(null);
        setLoading(false);
        setError(null);
        setRefreshError(null);
        setIsStale(false);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      const requestUserId = currentUserId;

      setLoading(true);
      setError(null);

      const monthsToFetch = getMonthsBetween(targetRange.startDate, targetRange.endDate);

      try {
        // Fetch official bank hours status and monthly workdays in parallel
        const [bankHoursResult, ...monthlyResults] = await Promise.allSettled([
          bankHoursService.getBankHours(),
          ...monthsToFetch.map((m) => workDayService.getMonthlyWorkDays(m)),
        ]);

        if (currentRequestId !== requestIdRef.current) return;
        if (requestUserId !== activeUserIdRef.current) return;

        let bankHours: BankHoursResponse | null = null;
        let bankHoursStatus: 'configured' | 'unconfigured' | 'error' = 'unconfigured';

        if (bankHoursResult.status === 'fulfilled') {
          bankHours = bankHoursResult.value;
          bankHoursStatus = bankHours?.configured ? 'configured' : 'unconfigured';
        } else {
          bankHoursStatus = 'error';
        }

        const collectedDays: MonthlyDaySummary[] = [];
        const failedMonths: string[] = [];
        const partialMonths: string[] = [];

        monthlyResults.forEach((res, index) => {
          const monthStr = monthsToFetch[index];
          if (res.status === 'fulfilled') {
            const data: MonthlyHistoryResponse = res.value;
            if (data && data.month === monthStr && Array.isArray(data.days)) {
              // Ensure data integrity: check dates belonging to the month, valid civil date, and deduplicate
              const dateMap = new Map<string, MonthlyDaySummary>();
              for (const day of data.days) {
                if (
                  day &&
                  typeof day.date === 'string' &&
                  isValidCivilDate(day.date) &&
                  day.date.substring(0, 7) === monthStr
                ) {
                  if (!dateMap.has(day.date)) {
                    dateMap.set(day.date, day);
                  }
                }
              }
              const cleanDays = Array.from(dateMap.values());
              collectedDays.push(...cleanDays);

              const [yStr, mStr] = monthStr.split('-');
              const year = parseInt(yStr, 10);
              const month = parseInt(mStr, 10);
              const expDays = year && month ? getDaysInMonth(year, month) : 30;

              // Verify that all expected civil days of this month actually exist in the received payload
              let hasAllExpectedDates = true;
              for (let d = 1; d <= expDays; d++) {
                const expectedDate = `${monthStr}-${String(d).padStart(2, '0')}`;
                if (!dateMap.has(expectedDate)) {
                  hasAllExpectedDates = false;
                  break;
                }
              }

              if (!hasAllExpectedDates || cleanDays.some((d) => d.status === 'DATA_UNAVAILABLE')) {
                partialMonths.push(monthStr);
              }
            } else {
              failedMonths.push(monthStr);
            }
          } else {
            failedMonths.push(monthStr);
          }
        });

        const currentLoaded = loadedStateRef.current;

        // If ALL requested months failed and we expected at least one
        if (monthsToFetch.length > 0 && failedMonths.length === monthsToFetch.length) {
          const msg = 'Não foi possível carregar os dados de jornada para o período selecionado.';
          if (
            currentLoaded &&
            currentLoaded.userId === requestUserId &&
            currentLoaded.range.startDate === targetRange.startDate &&
            currentLoaded.range.endDate === targetRange.endDate
          ) {
            setRefreshError('Não foi possível atualizar os dados do período. Exibindo dados anteriores à tentativa.');
            setIsStale(true);
          } else {
            setError(msg);
            loadedStateRef.current = null;
            setLoadedState(null);
          }
          setLoading(false);
          return;
        }

        setRefreshError(null);
        setIsStale(false);
        setError(null);
        const newState: LoadedState = {
          userId: requestUserId,
          range: targetRange,
          days: collectedDays,
          bankHours,
          bankHoursStatus,
          failedMonths,
          partialMonths,
        };
        loadedStateRef.current = newState;
        setLoadedState(newState);
      } catch (err: unknown) {
        if (currentRequestId !== requestIdRef.current) return;
        if (requestUserId !== activeUserIdRef.current) return;

        let errMsg = 'Não foi possível carregar os dados de análise de jornada.';
        if (axios.isAxiosError(err) && !err.response) {
          errMsg = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
        }

        const currentLoaded = loadedStateRef.current;
        if (
          currentLoaded &&
          currentLoaded.userId === requestUserId &&
          currentLoaded.range.startDate === targetRange.startDate &&
          currentLoaded.range.endDate === targetRange.endDate
        ) {
          setRefreshError('Falha ao atualizar os dados: ' + errMsg + ' Exibindo dados anteriores à tentativa.');
          setIsStale(true);
        } else {
          setError(errMsg);
          loadedStateRef.current = null;
          setLoadedState(null);
        }
      } finally {
        if (currentRequestId === requestIdRef.current && requestUserId === activeUserIdRef.current) {
          setLoading(false);
        }
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  const selectPreset = useCallback(
    (newPreset: AnalyticsPeriodPreset) => {
      setPreset(newPreset);
      setCustomError(null);

      if (newPreset !== 'custom') {
        const nextRange = getPresetRange(newPreset, todayStr);
        setRange(nextRange);
        setCustomStartDate(nextRange.startDate);
        setCustomEndDate(nextRange.endDate);
      }
    },
    [todayStr]
  );

  const applyCustomRange = useCallback((): boolean => {
    const val = validateCustomRange(customStartDate, customEndDate);
    if (!val.isValid) {
      setCustomError(val.error || 'Intervalo de datas inválido.');
      return false;
    }

    setCustomError(null);
    setPreset('custom');
    setRange({
      startDate: customStartDate,
      endDate: customEndDate,
    });
    return true;
  }, [customStartDate, customEndDate]);

  const refresh = useCallback(async () => {
    await fetchAnalytics(range);
  }, [fetchAnalytics, range]);

  const retry = useCallback(() => {
    fetchAnalytics(range);
  }, [fetchAnalytics, range]);

  // Validate coherence of state
  const isDataValid = Boolean(
    loadedState &&
    loadedState.userId === currentUserId &&
    loadedState.range.startDate === range.startDate &&
    loadedState.range.endDate === range.endDate
  );

  const analyticsData: WorkAnalyticsData | null = useMemo(() => {
    if (!isDataValid || !loadedState) return null;

    return aggregateWorkAnalytics(
      loadedState.days,
      loadedState.range,
      todayStr,
      loadedState.bankHours,
      loadedState.failedMonths,
      loadedState.bankHoursStatus,
      loadedState.partialMonths
    );
  }, [isDataValid, loadedState, todayStr]);

  // Warning when some months failed or had missing days or bank hours failed
  const warning = useMemo(() => {
    if (!loadedState || !analyticsData) return null;

    const messages: string[] = [];

    if (loadedState.failedMonths.length > 0) {
      messages.push(
        `Não foi possível carregar os dados de: ${loadedState.failedMonths.join(', ')}.`
      );
    }

    if (analyticsData.partialMonths.length > 0) {
      messages.push(
        `Alguns dias não foram fornecidos pelo servidor em: ${analyticsData.partialMonths.join(', ')}.`
      );
    }

    if (loadedState.bankHoursStatus === 'error') {
      messages.push('Não foi possível obter o extrato oficial do Banco de Horas no servidor.');
    }

    return messages.length > 0 ? messages.join(' ') : null;
  }, [loadedState, analyticsData]);

  return {
    preset,
    range,
    data: analyticsData,
    loading,
    error,
    refreshError,
    isStale,
    warning,
    customStartDate,
    customEndDate,
    customError,
    setCustomStartDate,
    setCustomEndDate,
    selectPreset,
    applyCustomRange,
    retry,
    refresh,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { MonthlyHistoryResponse, MonthlyDaySummary } from '../types/work-day';
import { workDayService } from '../services/work-day.service';
import { getCurrentMonthStr, shiftMonth, getTodayDateStr } from '../utils/date';

export function useMonthlyHistory() {
  const currentMonthStr = getCurrentMonthStr();
  const todayStr = getTodayDateStr();

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [data, setData] = useState<MonthlyHistoryResponse | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(todayStr);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);
  const isCurrentMonthSelected = selectedMonth === currentMonthStr;

  const fetchMonthly = useCallback(async (monthToFetch: string) => {
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    setData(null); // Clear stale data from previous month to prevent displaying old data under new month label

    try {
      const res = await workDayService.getMonthlyWorkDays(monthToFetch);

      // Discard response if a newer request was dispatched while this one was in flight
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setData(res);

      if (res.days.length > 0) {
        const todayMatch = res.days.find((d) => d.date === todayStr);
        if (todayMatch) {
          setSelectedDayDate(todayMatch.date);
        } else {
          setSelectedDayDate(res.days[0].date);
        }
      }
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (axios.isAxiosError(err) && !err.response) {
        setError('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
      } else {
        setError('Não foi possível carregar o histórico mensal.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [todayStr]);

  useEffect(() => {
    fetchMonthly(selectedMonth);
  }, [selectedMonth, fetchMonthly]);

  const goToPreviousMonth = () => {
    const prev = shiftMonth(selectedMonth, -1);
    setSelectedMonth(prev);
  };

  const goToNextMonth = () => {
    if (isCurrentMonthSelected) return;
    const next = shiftMonth(selectedMonth, 1);
    setSelectedMonth(next);
  };

  const selectDay = (dateStr: string) => {
    setSelectedDayDate(dateStr);
  };

  const selectedDay: MonthlyDaySummary | null =
    data?.days.find((d) => d.date === selectedDayDate) ?? null;

  return {
    selectedMonth,
    data,
    selectedDayDate,
    selectedDay,
    loading,
    error,
    isCurrentMonthSelected,
    goToPreviousMonth,
    goToNextMonth,
    selectDay,
    retry: () => fetchMonthly(selectedMonth),
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { MonthlyHistoryResponse, MonthlyDaySummary } from '../types/work-day';
import { workDayService } from '../services/work-day.service';
import { holidayService } from '../services/holiday.service';
import { getCurrentMonthStr, shiftMonth, getTodayDateStr } from '../utils/date';

// In-session cache of synced years to avoid repeated sync requests
const sessionSyncedYears = new Set<number>();

export function useMonthlyHistory() {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');

  const currentMonthStr = getCurrentMonthStr();
  const todayStr = getTodayDateStr();

  // Validate date param (YYYY-MM-DD)
  const isValidDateParam = !!dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
  const initialMonth = isValidDateParam ? dateParam.substring(0, 7) : currentMonthStr;
  const initialDayDate = isValidDateParam ? dateParam : todayStr;

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [data, setData] = useState<MonthlyHistoryResponse | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(initialDayDate);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [holidayWarning, setHolidayWarning] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);
  const isCurrentMonthSelected = selectedMonth === currentMonthStr;

  // React to change in search param date
  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const paramMonth = dateParam.substring(0, 7);
      setSelectedMonth(paramMonth);
      setSelectedDayDate(dateParam);
    }
  }, [dateParam]);

  const fetchMonthly = useCallback(async (monthToFetch: string, targetDayDate?: string | null) => {
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const res = await workDayService.getMonthlyWorkDays(monthToFetch);

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setData(res);

      if (res.days.length > 0) {
        // If a specific targetDayDate was requested or selectedDayDate belongs to this month, keep it
        const dayToSelect = targetDayDate || selectedDayDate;
        const match = res.days.find((d) => d.date === dayToSelect);
        if (match) {
          setSelectedDayDate(match.date);
        } else {
          const todayMatch = res.days.find((d) => d.date === todayStr);
          setSelectedDayDate(todayMatch ? todayMatch.date : res.days[0].date);
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
  }, [todayStr, selectedDayDate]);

  useEffect(() => {
    fetchMonthly(selectedMonth);
  }, [selectedMonth, fetchMonthly]);

  // Automatic one-shot sync per year navigated in this session
  useEffect(() => {
    const year = parseInt(selectedMonth.split('-')[0], 10);
    if (!Number.isNaN(year) && !sessionSyncedYears.has(year)) {
      sessionSyncedYears.add(year);
      holidayService
        .syncHolidays(year)
        .then((res) => {
          if (res.synced > 0) {
            // Refresh to populate calendar with newly synced holidays
            fetchMonthly(selectedMonth);
          }
        })
        .catch(() => {
          setHolidayWarning(
            'Não foi possível atualizar os feriados. O calendário continua disponível.'
          );
        });
    }
  }, [selectedMonth, fetchMonthly]);

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    try {
      const res = await workDayService.getMonthlyWorkDays(selectedMonth);
      if (currentRequestId !== requestIdRef.current) return;
      setData(res);
    } catch (err: unknown) {
      // silently retain existing state on background refresh error
    }
  }, [selectedMonth]);

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
    holidayWarning,
    isCurrentMonthSelected,
    goToPreviousMonth,
    goToNextMonth,
    selectDay,
    refresh,
    retry: () => fetchMonthly(selectedMonth),
  };
}

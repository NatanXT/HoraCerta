import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { MonthlyHistoryResponse, MonthlyDaySummary } from '../../types/work-day';
import { CalendarViewMode, SmartCalendarGridData } from './types';
import { workDayService } from '../../services/work-day.service';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentMonthStr, shiftMonth, getTodayDateStr } from '../../utils/date';
import { buildSmartCalendarGrid } from './smart-calendar-calculator';
import { inFlightTracker } from '../pwa/utils/inFlightTracker';

export interface UseSmartCalendarResult {
  selectedMonth: string;
  data: MonthlyHistoryResponse | null;
  gridData: SmartCalendarGridData | null;
  selectedDayDate: string | null;
  selectedDay: MonthlyDaySummary | null;
  viewMode: CalendarViewMode;
  loading: boolean;
  error: string | null;
  holidayWarning: string | null;
  isCurrentMonthSelected: boolean;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  goToToday: () => void;
  selectDay: (dateStr: string) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  refresh: () => Promise<void>;
  retry: () => void;
}

interface MonthlyDataState {
  userId: string;
  month: string;
  data: MonthlyHistoryResponse;
}

export function useSmartCalendar(): UseSmartCalendarResult {
  const { user } = useAuth();
  const currentUserId = user?.id || '';

  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');

  const currentMonthStr = getCurrentMonthStr();
  const todayStr = getTodayDateStr();

  // Validate initial date param (YYYY-MM-DD)
  const isValidDateParam = !!dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
  const initialMonth = isValidDateParam ? dateParam.substring(0, 7) : currentMonthStr;
  const initialDayDate = isValidDateParam ? dateParam : todayStr;

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [dataState, setDataState] = useState<MonthlyDataState | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(initialDayDate);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('calendar');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const requestIdRef = useRef<number>(0);
  const activeUserIdRef = useRef<string>(currentUserId);
  const selectedDayDateRef = useRef<string | null>(initialDayDate);
  selectedDayDateRef.current = selectedDayDate;
  const dataStateRef = useRef<MonthlyDataState | null>(null);
  dataStateRef.current = dataState;

  // Sincronização síncrona imediata durante renderização na troca de usuário ou logout
  if (activeUserIdRef.current !== currentUserId) {
    activeUserIdRef.current = currentUserId;
    requestIdRef.current++;
    setDataState(null);
    dataStateRef.current = null;
    setSelectedDayDate(null);
    setError(null);
    setWarning(null);
  }

  const isCurrentMonthSelected = selectedMonth === currentMonthStr;

  // React to change in URL search param date (?date=YYYY-MM-DD)
  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const paramMonth = dateParam.substring(0, 7);
      setSelectedMonth(paramMonth);
      setSelectedDayDate(dateParam);
    }
  }, [dateParam]);

  // Função estável de busca mensal: NÃO depende de selectedDayDate para não disparar consultas extras
  const fetchMonthly = useCallback(
    async (monthToFetch: string, targetDayDate?: string | null) => {
      if (!currentUserId) {
        setDataState(null);
        setLoading(false);
        setError(null);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      const requestUserId = currentUserId;

      setLoading(true);
      setError(null);
      setWarning(null);

      try {
        const res = await workDayService.getMonthlyWorkDays(monthToFetch);

        // Proteção contra concorrência e respostas fora de ordem
        if (currentRequestId !== requestIdRef.current) return;
        if (requestUserId !== activeUserIdRef.current) return;

        // Validação estrita de payload e competência da resposta recebida
        if (!res || typeof res !== 'object' || !Array.isArray(res.days)) {
          setError('Payload inválido retornado pelo servidor.');
          setLoading(false);
          return;
        }

        if (res.month !== monthToFetch) {
          setError('Resposta com mês inconsistente retornada pelo servidor.');
          setLoading(false);
          return;
        }

        // Associa a resposta ao usuário e ao mês consultado
        setDataState({
          userId: requestUserId,
          month: monthToFetch,
          data: res,
        });

        if (res.days && res.days.length > 0) {
          const currentDayPref = targetDayDate || selectedDayDateRef.current;
          const match = res.days.find((d) => d.date === currentDayPref);
          if (match) {
            setSelectedDayDate(match.date);
          } else {
            const todayMatch = res.days.find((d) => d.date === todayStr);
            setSelectedDayDate(todayMatch ? todayMatch.date : res.days[0].date);
          }
        }
      } catch (err: unknown) {
        if (currentRequestId !== requestIdRef.current) return;
        if (requestUserId !== activeUserIdRef.current) return;

        if (axios.isAxiosError(err) && !err.response) {
          setError(
            'Não foi possível conectar ao servidor. Verifique sua conexão ou se o backend está em execução.'
          );
        } else {
          setError('Não foi possível carregar o histórico de jornada deste mês.');
        }
      } finally {
        if (currentRequestId === requestIdRef.current && requestUserId === activeUserIdRef.current) {
          setLoading(false);
        }
      }
    },
    [currentUserId, todayStr]
  );

  // Efeito disparado unicamente quando o mês ou o usuário mudam
  useEffect(() => {
    fetchMonthly(selectedMonth);
  }, [selectedMonth, currentUserId, fetchMonthly]);

  // Atualização em background (ex.: após salvar ajuste manual)
  const refresh = useCallback(async () => {
    if (!currentUserId) return;
    const currentRequestId = ++requestIdRef.current;
    const requestUserId = currentUserId;
    try {
      const res = await workDayService.getMonthlyWorkDays(selectedMonth);
      if (currentRequestId !== requestIdRef.current) return;
      if (requestUserId !== activeUserIdRef.current) return;

      // Validação estrita de payload e competência da resposta no refresh
      if (!res || typeof res !== 'object' || !Array.isArray(res.days)) {
        throw new Error('Payload inválido retornado pelo servidor.');
      }

      if (res.month !== selectedMonth) {
        throw new Error('Resposta com mês inconsistente retornada pelo servidor.');
      }

      setDataState({
        userId: requestUserId,
        month: selectedMonth,
        data: res,
      });
      setError(null);
      setWarning(null);
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current) return;
      if (requestUserId !== activeUserIdRef.current) return;

      const hasValidData = Boolean(
        dataStateRef.current &&
        dataStateRef.current.userId === requestUserId &&
        dataStateRef.current.month === selectedMonth &&
        dataStateRef.current.data?.month === selectedMonth
      );

      let errorMessage = 'Não foi possível carregar o histórico de jornada deste mês.';
      if (err instanceof Error) {
        if (
          err.message === 'Resposta com mês inconsistente retornada pelo servidor.' ||
          err.message === 'Payload inválido retornado pelo servidor.'
        ) {
          errorMessage = err.message;
        } else if (axios.isAxiosError(err) && !err.response) {
          errorMessage =
            'Não foi possível conectar ao servidor. Verifique sua conexão ou se o backend está em execução.';
        }
      }

      if (!hasValidData) {
        setError(errorMessage);
      } else {
        setWarning(
          'Não foi possível atualizar os dados mais recentes. Exibindo informações salvas da consulta anterior.'
        );
      }
    } finally {
      if (currentRequestId === requestIdRef.current && requestUserId === activeUserIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedMonth, currentUserId]);

  const changeMonth = useCallback(
    (newMonth: string) => {
      if (inFlightTracker.hasDirtyForms()) {
        const confirmDiscard = window.confirm(
          'Existem alterações não salvas em formulários. Deseja realmente mudar de mês e descartar as alterações?'
        );
        if (!confirmDiscard) return;
      }
      setSelectedMonth(newMonth);
      setError(null);
      setWarning(null);
      if (newMonth === currentMonthStr) {
        setSelectedDayDate(todayStr);
      } else {
        setSelectedDayDate(`${newMonth}-01`);
      }
    },
    [currentMonthStr, todayStr]
  );

  const goToPreviousMonth = useCallback(() => {
    const prev = shiftMonth(selectedMonth, -1);
    changeMonth(prev);
  }, [selectedMonth, changeMonth]);

  const goToNextMonth = useCallback(() => {
    const next = shiftMonth(selectedMonth, 1);
    changeMonth(next);
  }, [selectedMonth, changeMonth]);

  const goToCurrentMonth = useCallback(() => {
    changeMonth(currentMonthStr);
  }, [currentMonthStr, changeMonth]);

  const goToToday = goToCurrentMonth;

  // Seleção de dia pura: NÃO causa consultas de rede
  const selectDay = useCallback((dateStr: string) => {
    setSelectedDayDate(dateStr);
  }, []);

  // Alternância de modo pura: NÃO causa consultas de rede
  const handleViewModeChange = useCallback((mode: CalendarViewMode) => {
    setViewMode(mode);
  }, []);

  // Validação estrita de coerência de dados antes de expor para a interface
  const isCurrentDataValid = Boolean(
    dataState &&
    dataState.userId === currentUserId &&
    dataState.month === selectedMonth &&
    dataState.data?.month === selectedMonth
  );

  // Se o mês selecionado não bater com os dados carregados, expõe null (nunca dados do mês anterior)
  const data: MonthlyHistoryResponse | null = isCurrentDataValid ? dataState!.data : null;

  const gridData: SmartCalendarGridData | null = useMemo(() => {
    if (!data?.days) return null;
    return buildSmartCalendarGrid(data.days, selectedMonth, todayStr);
  }, [data, selectedMonth, todayStr]);

  const selectedDay: MonthlyDaySummary | null = useMemo(() => {
    if (!gridData?.days || !selectedDayDate) return null;
    const match = gridData.days.find((d) => d.summary.date === selectedDayDate);
    return match ? match.summary : null;
  }, [gridData, selectedDayDate]);

  const computedWarning = useMemo(() => {
    if (warning) return warning;
    if (gridData?.days && gridData.days.some((d) => d.indicators.isDataUnavailable)) {
      return 'Atenção: Alguns dias deste mês não foram fornecidos pelo servidor. Os demais dias apresentam os dados oficiais recebidos.';
    }
    return null;
  }, [warning, gridData]);

  return {
    selectedMonth,
    data,
    gridData,
    selectedDayDate,
    selectedDay,
    viewMode,
    loading,
    error,
    holidayWarning: computedWarning,
    isCurrentMonthSelected,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    goToToday,
    selectDay,
    setViewMode: handleViewModeChange,
    refresh,
    retry: () => fetchMonthly(selectedMonth),
  };
}

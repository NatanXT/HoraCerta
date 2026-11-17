import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { settingsService } from '../../services/settings.service';
import { holidayService } from '../../services/holiday.service';
import { calendarOccurrenceService } from '../../services/calendar-occurrence.service';
import { Holiday } from '../../types/holiday';
import { CalendarOccurrence } from '../../types/calendar-occurrence';
import { WorkScheduleDay } from '../../types/settings';
import { formatBalanceInput, parseBalanceInput } from '../../utils/time';
import {
  SimulationMode,
  CompensationSimulationInput,
  CompensationSimulationResult,
  CalendarStatus,
  CalendarContextData,
} from './types';
import {
  calculateCompensationSimulation,
  addDaysCivilDate,
  validateWorkSchedule,
  isValidCivilDate,
} from './compensation-calculator';

export interface UseBankHoursPlanningProps {
  currentBalanceMinutes: number;
  todayStr: string;
}

export function useBankHoursPlanning({
  currentBalanceMinutes,
  todayStr,
}: UseBankHoursPlanningProps) {
  const { user } = useAuth();
  const currentUserId = user?.id || '';

  // Min and max allowable target dates
  const minTargetDate = useMemo(() => addDaysCivilDate(todayStr, 1), [todayStr]);
  const maxTargetDate = useMemo(() => addDaysCivilDate(todayStr, 365), [todayStr]);

  // Default target date: 30 days ahead
  const defaultTargetDate = useMemo(() => {
    const projected = addDaysCivilDate(todayStr, 30);
    return projected <= maxTargetDate ? projected : maxTargetDate;
  }, [todayStr, maxTargetDate]);

  // Initial target balance: 0 if negative, otherwise current balance
  const initialTargetBalance = useMemo(
    () => (currentBalanceMinutes < 0 ? 0 : currentBalanceMinutes),
    [currentBalanceMinutes]
  );

  const [mode, setMode] = useState<SimulationMode>('TARGET_DATE');
  const [targetDateStr, setTargetDateStr] = useState<string>(defaultTargetDate);
  const [targetBalanceMinutes, setTargetBalanceMinutes] = useState<number | null>(
    initialTargetBalance
  );
  const [targetBalanceInput, setTargetBalanceInput] = useState<string>(
    formatBalanceInput(initialTargetBalance)
  );
  const [targetBalanceError, setTargetBalanceError] = useState<string | null>(null);
  const [dailyAdditionMinutes, setDailyAdditionMinutes] = useState<number>(30);

  // Calendar context state associated with user and target date
  const [calendarContext, setCalendarContext] = useState<CalendarContextData | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>('loading');
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Race condition sequence tracker and active refs
  const requestSeqRef = useRef<number>(0);
  const activeUserIdRef = useRef<string>(currentUserId);
  const activeTargetDateRef = useRef<string>(targetDateStr);
  const isMountedRef = useRef<boolean>(true);
  const lastUserIdRef = useRef<string>(currentUserId);
  const currentBalanceRef = useRef<number>(currentBalanceMinutes);
  currentBalanceRef.current = currentBalanceMinutes;
  const defaultTargetDateRef = useRef<string>(defaultTargetDate);
  defaultTargetDateRef.current = defaultTargetDate;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update active refs
  activeUserIdRef.current = currentUserId;
  activeTargetDateRef.current = targetDateStr;

  // Handle user change or logout (strictly decoupled from balance updates)
  useEffect(() => {
    if (currentUserId === lastUserIdRef.current) {
      // Same user: balance updates or rerenders must NEVER reset inputs or calendar context
      return;
    }

    lastUserIdRef.current = currentUserId;

    if (!currentUserId) {
      // User logged out: clear state and set idle
      setCalendarContext(null);
      setCalendarStatus('idle');
      setCalendarError(null);
      return;
    }

    // New user session: initialize defaults for the newly active account
    const freshBalance = currentBalanceRef.current;
    const freshInitialTarget = freshBalance < 0 ? 0 : freshBalance;
    setTargetBalanceMinutes(freshInitialTarget);
    setTargetBalanceInput(formatBalanceInput(freshInitialTarget));
    setTargetBalanceError(null);
    setTargetDateStr(defaultTargetDateRef.current);
    setDailyAdditionMinutes(30);
    setCalendarContext(null);
    setCalendarStatus('loading');
    setCalendarError(null);
  }, [currentUserId]);

  // Fetch calendar context data for the active user and target date
  const fetchCalendarContext = useCallback(
    async (targetDate: string) => {
      if (!currentUserId) {
        setCalendarStatus('idle');
        return;
      }

      const seq = ++requestSeqRef.current;
      setCalendarStatus('loading');
      setCalendarError(null);

      // Do NOT retain stale context from an older period or account
      setCalendarContext(null);

      try {
        const todayYear = parseInt(todayStr.split('-')[0], 10);
        const targetYear = parseInt(targetDate.split('-')[0], 10);

        // Collect unique years needed for holidays
        const yearsNeeded = [todayYear];
        if (targetYear > todayYear) {
          for (let y = todayYear + 1; y <= targetYear; y++) {
            yearsNeeded.push(y);
          }
        }

        // Fetch settings, occurrences, and holidays without silently masking errors
        const settingsPromise = settingsService.getSettings();
        const occurrencesPromise = calendarOccurrenceService.getOccurrences(
          todayStr,
          targetDate
        );
        const holidaysPromises = yearsNeeded.map((y) => holidayService.getHolidays(y));

        const [settingsRes, occurrencesRes, ...holidaysPerYear] = await Promise.all([
          settingsPromise.catch((err) => {
            throw { source: 'settings', original: err };
          }),
          occurrencesPromise.catch((err) => {
            throw { source: 'occurrences', original: err };
          }),
          ...holidaysPromises.map((p) =>
            p.catch((err) => {
              throw { source: 'holidays', original: err };
            })
          ),
        ]);

        if (!isMountedRef.current) return;
        if (seq !== requestSeqRef.current) return;
        if (currentUserId !== activeUserIdRef.current) return;
        if (targetDate !== activeTargetDateRef.current) return;

        // Verify civil date validity of target date
        if (!isValidCivilDate(targetDate)) {
          setCalendarStatus('error');
          setCalendarError('Data limite inválida ou inexistente no calendário.');
          return;
        }

        // Verify schedule presence and canonical 7-day contract
        const scheduleDays: WorkScheduleDay[] = settingsRes?.workSchedule?.days || [];
        const scheduleValidation = validateWorkSchedule(scheduleDays);
        if (!scheduleValidation.isValid) {
          setCalendarStatus('error');
          setCalendarError(
            scheduleValidation.errorMessage ||
              'Configuração de expediente ausente ou incompleta. Defina sua jornada semanal nas Configurações para habilitar a simulação.'
          );
          return;
        }

        const combinedHolidays: Holiday[] = holidaysPerYear.flat();
        const occurrencesList: CalendarOccurrence[] = occurrencesRes || [];

        // Successfully loaded complete calendar context
        setCalendarContext({
          userId: currentUserId,
          targetDateStr: targetDate,
          workScheduleDays: scheduleDays,
          holidays: combinedHolidays,
          occurrences: occurrencesList,
        });
        setCalendarStatus('ready');
        setCalendarError(null);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        if (seq !== requestSeqRef.current) return;
        if (currentUserId !== activeUserIdRef.current) return;

        setCalendarStatus('error');
        setCalendarContext(null);

        if (err?.source === 'settings') {
          setCalendarError('Não foi possível carregar a configuração de expediente de trabalho.');
        } else if (err?.source === 'holidays') {
          setCalendarError('Não foi possível carregar a relação de feriados do período selecionado.');
        } else if (err?.source === 'occurrences') {
          setCalendarError('Não foi possível carregar as ausências cadastradas para o período.');
        } else {
          setCalendarError(
            'Não foi possível obter dados completos do calendário para o período selecionado.'
          );
        }
      }
    },
    [currentUserId, todayStr]
  );

  // Trigger calendar fetch when user or target date changes
  useEffect(() => {
    if (currentUserId && targetDateStr) {
      fetchCalendarContext(targetDateStr);
    }
  }, [currentUserId, targetDateStr, fetchCalendarContext]);

  // Handle target balance input change with immediate validation
  const handleTargetBalanceInputChange = (value: string) => {
    setTargetBalanceInput(value);
    const parsed = parseBalanceInput(value);
    if (parsed === null) {
      setTargetBalanceMinutes(null);
      setTargetBalanceError(
        'Formato de meta de saldo inválido. Utilize o formato HH:MM (ex: 00:00, +02:00, -01:15).'
      );
    } else {
      setTargetBalanceMinutes(parsed);
      setTargetBalanceError(null);
    }
  };

  // Handle target date change with validation
  const handleTargetDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    setTargetDateStr(newDateStr);
  };

  // Handle Mode B daily addition change with validation
  const handleDailyAdditionChange = (value: number) => {
    if (isNaN(value)) {
      setDailyAdditionMinutes(0);
      return;
    }
    const safeVal = Math.max(0, Math.min(480, Math.round(value)));
    setDailyAdditionMinutes(safeVal);
  };

  // Assemble active calendar data ensuring user and period match
  const activeCalendarData: CalendarContextData = useMemo(() => {
    if (
      calendarStatus === 'ready' &&
      calendarContext &&
      calendarContext.userId === currentUserId &&
      calendarContext.targetDateStr === targetDateStr
    ) {
      return calendarContext;
    }
    return {
      userId: currentUserId,
      targetDateStr,
      workScheduleDays: undefined,
      holidays: undefined,
      occurrences: undefined,
    };
  }, [calendarStatus, calendarContext, currentUserId, targetDateStr]);

  // Compute simulation result reactively
  const simulationResult: CompensationSimulationResult = useMemo(() => {
    const input: CompensationSimulationInput = {
      currentBalanceMinutes,
      targetBalanceMinutes,
      targetDateStr,
      dailyAdditionMinutes,
      mode,
    };

    return calculateCompensationSimulation(input, activeCalendarData, todayStr);
  }, [
    currentBalanceMinutes,
    targetBalanceMinutes,
    targetDateStr,
    dailyAdditionMinutes,
    mode,
    activeCalendarData,
    todayStr,
  ]);

  return {
    mode,
    setMode,
    targetDateStr,
    setTargetDateStr: handleTargetDateChange,
    minTargetDate,
    maxTargetDate,
    targetBalanceMinutes,
    targetBalanceInput,
    targetBalanceError,
    setTargetBalanceInput: handleTargetBalanceInputChange,
    dailyAdditionMinutes,
    setDailyAdditionMinutes: handleDailyAdditionChange,
    calendarStatus,
    loadingCalendar: calendarStatus === 'loading',
    calendarError,
    simulationResult,
    retry: () => fetchCalendarContext(targetDateStr),
  };
}

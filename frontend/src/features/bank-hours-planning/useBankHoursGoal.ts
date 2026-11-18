import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  SavedBankHoursGoal,
  GoalProgressResult,
  SimulationMode,
  CalendarStatus,
  CalendarContextData,
  CompensationSimulationResult,
} from './types';
import {
  getActiveGoal,
  saveActiveGoal,
  clearActiveGoal,
} from './goal-storage';
import {
  calculateGoalProgress,
  calculateRemainingGoalForecast,
} from './goal-calculator';
import {
  validateWorkSchedule,
  isValidCivilDate,
} from './compensation-calculator';
import { settingsService } from '../../services/settings.service';
import { holidayService } from '../../services/holiday.service';
import { calendarOccurrenceService } from '../../services/calendar-occurrence.service';
import { WorkScheduleDay } from '../../types/settings';

export interface CreateGoalParams {
  title?: string;
  targetBalanceMinutes: number;
  targetDateStr: string;
  mode: SimulationMode;
  dailyAdditionMinutes?: number;
}

export interface UseBankHoursGoalProps {
  userId: string;
  currentBalanceMinutes: number;
  todayStr: string;
}

export function useBankHoursGoal({
  userId,
  currentBalanceMinutes,
  todayStr,
}: UseBankHoursGoalProps) {
  // Sincronização IMEDIATA de estado durante a renderização para impedir qualquer
  // vazamento de dados do usuário anterior na tela antes da execução de efeitos
  const [userGoalState, setUserGoalState] = useState<{
    userId: string;
    goal: SavedBankHoursGoal | null;
  }>(() => {
    return {
      userId,
      goal: userId ? getActiveGoal(userId) : null,
    };
  });

  // Ajuste síncrono durante renderização quando userId mudar (inclusive em logout)
  if (userGoalState.userId !== userId) {
    const immediateGoal = userId ? getActiveGoal(userId) : null;
    setUserGoalState({ userId, goal: immediateGoal });
  }

  // A meta ativa só pode ser exposta se houver usuário autenticado e se pertencer a ele
  const activeGoal: SavedBankHoursGoal | null = useMemo(() => {
    if (!userId || !userGoalState.goal) return null;
    if (userGoalState.userId !== userId || userGoalState.goal.userId !== userId) {
      return null;
    }
    return userGoalState.goal;
  }, [userId, userGoalState]);

  // Recalcula o progresso estritamente para a meta válida do usuário ativo
  const progress: GoalProgressResult | null = useMemo(() => {
    if (!activeGoal) return null;
    return calculateGoalProgress(activeGoal, currentBalanceMinutes, todayStr);
  }, [activeGoal, currentBalanceMinutes, todayStr]);

  // Calendário e previsão independente dedicados aos parâmetros da meta salva
  const [calendarContext, setCalendarContext] = useState<CalendarContextData | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>('idle');
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const requestSeqRef = useRef<number>(0);
  const activeUserIdRef = useRef<string>(userId);
  const activeGoalDateRef = useRef<string>(activeGoal?.targetDateStr || '');
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  activeUserIdRef.current = userId;
  activeGoalDateRef.current = activeGoal?.targetDateStr || '';

  // Consulta calendário dedicada aos prazos específicos da meta salva
  const fetchGoalCalendar = useCallback(
    async (targetDate: string, targetUserId: string) => {
      if (!targetUserId || !targetDate) {
        setCalendarContext(null);
        setCalendarStatus('idle');
        setCalendarError(null);
        return;
      }

      const seq = ++requestSeqRef.current;
      setCalendarStatus('loading');
      setCalendarError(null);

      try {
        if (!isValidCivilDate(targetDate)) {
          setCalendarStatus('error');
          setCalendarError('Data limite da meta inválida.');
          return;
        }

        const todayYear = parseInt(todayStr.split('-')[0], 10);
        const targetYear = parseInt(targetDate.split('-')[0], 10);
        const yearsNeeded = [todayYear];
        if (targetYear > todayYear) {
          for (let y = todayYear + 1; y <= targetYear; y++) {
            yearsNeeded.push(y);
          }
        }

        const [settingsRes, occurrencesRes, ...holidaysPerYear] = await Promise.all([
          settingsService.getSettings(),
          calendarOccurrenceService.getOccurrences(todayStr, targetDate),
          ...yearsNeeded.map((y) => holidayService.getHolidays(y)),
        ]);

        if (!isMountedRef.current) return;
        if (seq !== requestSeqRef.current) return;
        if (targetUserId !== activeUserIdRef.current) return;
        if (targetDate !== activeGoalDateRef.current) return;

        const scheduleDays: WorkScheduleDay[] = settingsRes?.workSchedule?.days || [];
        const scheduleValidation = validateWorkSchedule(scheduleDays);
        if (!scheduleValidation.isValid) {
          setCalendarStatus('error');
          setCalendarError(
            scheduleValidation.errorMessage ||
              'Configuração de expediente ausente ou incompleta.'
          );
          return;
        }

        const contextData: CalendarContextData = {
          userId: targetUserId,
          targetDateStr: targetDate,
          workScheduleDays: scheduleDays,
          holidays: holidaysPerYear.flat(),
          occurrences: occurrencesRes || [],
        };

        setCalendarContext(contextData);
        setCalendarStatus('ready');
        setCalendarError(null);
      } catch {
        if (!isMountedRef.current) return;
        if (seq !== requestSeqRef.current) return;
        if (targetUserId !== activeUserIdRef.current) return;

        setCalendarStatus('error');
        setCalendarContext(null);
        setCalendarError(
          'Não foi possível consultar o calendário para calcular a previsão da meta.'
        );
      }
    },
    [todayStr]
  );

  // Dispara a busca do calendário da meta apenas quando a meta estiver ativa e não concluída/expirada
  useEffect(() => {
    if (!userId || !activeGoal) {
      setCalendarContext(null);
      setCalendarStatus('idle');
      setCalendarError(null);
      return;
    }

    if (progress?.isAchieved || progress?.isExpired) {
      // Metas concluídas ou vencidas não necessitam de cálculo de compensação futura
      setCalendarStatus('ready');
      setCalendarContext(null);
      setCalendarError(null);
      return;
    }

    fetchGoalCalendar(activeGoal.targetDateStr, userId);
  }, [
    userId,
    activeGoal?.id,
    activeGoal?.targetDateStr,
    progress?.isAchieved,
    progress?.isExpired,
    fetchGoalCalendar,
  ]);

  // Recalcula a previsão dinâmica da meta salva exclusivamente com seus próprios parâmetros
  const forecast: CompensationSimulationResult | null = useMemo(() => {
    if (!activeGoal || !progress || progress.isAchieved || progress.isExpired) {
      return null;
    }
    if (calendarStatus !== 'ready' || !calendarContext) {
      return null;
    }
    if (
      calendarContext.userId !== userId ||
      calendarContext.targetDateStr !== activeGoal.targetDateStr
    ) {
      return null;
    }

    return calculateRemainingGoalForecast(
      activeGoal,
      currentBalanceMinutes,
      calendarContext,
      todayStr
    );
  }, [
    activeGoal,
    progress,
    calendarStatus,
    calendarContext,
    userId,
    currentBalanceMinutes,
    todayStr,
  ]);

  // Salva explicitamente uma nova meta para o usuário ativo
  const saveGoal = useCallback(
    (params: CreateGoalParams): boolean => {
      if (!userId) return false;

      const newGoal: SavedBankHoursGoal = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        title: params.title?.trim() || undefined,
        targetBalanceMinutes: params.targetBalanceMinutes,
        targetDateStr: params.targetDateStr,
        mode: params.mode,
        dailyAdditionMinutes: params.dailyAdditionMinutes,
        baselineBalanceMinutes: currentBalanceMinutes,
        createdAtStr: todayStr,
        createdAtTimestamp: Date.now(),
      };

      const success = saveActiveGoal(userId, newGoal);
      if (success) {
        setUserGoalState({ userId, goal: newGoal });
      }
      return success;
    },
    [userId, currentBalanceMinutes, todayStr]
  );

  // Encerra/descarta a meta ativa voluntariamente
  const discardGoal = useCallback((): boolean => {
    if (!userId) return false;
    const success = clearActiveGoal(userId);
    if (success) {
      setUserGoalState({ userId, goal: null });
      setCalendarContext(null);
      setCalendarStatus('idle');
      setCalendarError(null);
    }
    return success;
  }, [userId]);

  return {
    activeGoal,
    progress,
    forecast,
    calendarStatus,
    calendarError,
    retryCalendar: () => {
      if (activeGoal && userId) {
        fetchGoalCalendar(activeGoal.targetDateStr, userId);
      }
    },
    saveGoal,
    discardGoal,
    hasActiveGoal: activeGoal !== null,
  };
}

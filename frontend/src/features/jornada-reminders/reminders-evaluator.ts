import { WorkDayWithSession } from '../../services/work-session.service';
import { ProfileScheduleDay } from '../../services/profile.service';
import { ReminderSettings, ScheduledReminder } from './types';
import { parseCivilDateTimeToUtc } from '../../utils/date';
import { env } from '../../config/env';

export interface PredictedExitResult {
  predictedExitDate: Date;
  remainingMinutes: number;
  isOvertime: boolean;
}

/**
 * Formats a Date object into HH:mm string in configured application timezone.
 */
export function formatHHmm(
  date: Date,
  timeZone: string = env.VITE_APP_TIMEZONE
): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch (_error) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Calculates the predicted departure (saída prevista) based on real workday records.
 * Uses exact math: targetWorkMs - completedSessionsMs + openClockInTimeMs.
 */
export function calculatePredictedExit(params: {
  workDay: WorkDayWithSession | null;
  scheduleDay?: ProfileScheduleDay | null;
  now?: Date;
}): PredictedExitResult | null {
  const { workDay, now = new Date() } = params;

  if (!workDay || workDay.expectedMinutes <= 0) {
    return null;
  }

  const entries = (workDay.entries || []).filter((e) => !(e as any).deletedAt);
  if (entries.length === 0) {
    return null;
  }

  // If day is already ended, no predicted exit
  const isEnded =
    workDay.session?.state === 'ENDED' ||
    (!workDay.isOpen && entries.length > 0 && entries[entries.length - 1].type === 'CLOCK_OUT');
  if (isEnded) {
    return null;
  }

  // Sort chronological
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalCompletedMs = 0;
  let openClockInMs: number | null = null;

  for (const entry of sorted) {
    const timeMs = new Date(entry.timestamp).getTime();
    if (entry.type === 'CLOCK_IN') {
      openClockInMs = timeMs;
    } else if (entry.type === 'CLOCK_OUT' && openClockInMs !== null) {
      totalCompletedMs += Math.max(0, timeMs - openClockInMs);
      openClockInMs = null;
    }
  }

  const targetWorkMs = workDay.expectedMinutes * 60000;
  const remainingWorkMs = Math.max(0, targetWorkMs - totalCompletedMs);

  // Case A: Currently working with an open CLOCK_IN session
  if (openClockInMs !== null) {
    const predictedExitMs = openClockInMs + remainingWorkMs;
    const predictedExitDate = new Date(predictedExitMs);
    const remainingMinutes = Math.max(
      0,
      Math.ceil((predictedExitMs - now.getTime()) / 60000)
    );
    const isOvertime = now.getTime() > predictedExitMs;

    return {
      predictedExitDate,
      remainingMinutes,
      isOvertime,
    };
  }

  // Case B: Currently on an active break (work is paused)
  const session = workDay.session;
  const isOnBreak =
    session?.state === 'ON_SNACK_BREAK' ||
    session?.state === 'ON_LUNCH_BREAK' ||
    Boolean(session?.activeBreak);

  if (isOnBreak && session?.activeBreak) {
    const activeBreak = session.activeBreak;
    let expectedResumeMs: number | null = null;

    if (activeBreak.autoResumeAt) {
      expectedResumeMs = new Date(activeBreak.autoResumeAt).getTime();
    } else if (activeBreak.plannedDurationMinutes && activeBreak.plannedDurationMinutes > 0) {
      expectedResumeMs =
        new Date(activeBreak.startedAt).getTime() + activeBreak.plannedDurationMinutes * 60000;
    } else if (params.scheduleDay) {
      const dur =
        activeBreak.type === 'LUNCH'
          ? params.scheduleDay.lunchBreakMinutes
          : params.scheduleDay.snackBreakMinutes;
      if (dur > 0) {
        expectedResumeMs = new Date(activeBreak.startedAt).getTime() + dur * 60000;
      }
    }

    if (expectedResumeMs && expectedResumeMs > 0) {
      const effectiveBaseMs = Math.max(now.getTime(), expectedResumeMs);
      const predictedExitMs = effectiveBaseMs + remainingWorkMs;
      const predictedExitDate = new Date(predictedExitMs);
      const remainingMinutes = Math.max(
        0,
        Math.ceil((predictedExitMs - now.getTime()) / 60000)
      );

      return {
        predictedExitDate,
        remainingMinutes,
        isOvertime: now.getTime() > predictedExitMs,
      };
    }
  }

  return null;
}

export interface EvaluateRemindersParams {
  settings: ReminderSettings;
  userId: string;
  dateStr: string; // YYYY-MM-DD
  workDay: WorkDayWithSession | null;
  scheduleDay?: ProfileScheduleDay | null;
  now?: Date;
  dispatchedIds?: Set<string>;
}

export interface EvaluationResult {
  readyToTrigger: ScheduledReminder[];
  upcomingNext: ScheduledReminder | null;
  allScheduled: ScheduledReminder[];
}

/**
 * Pure evaluator for workday reminders. Evaluates Entry, Break Return, Exit, and Overtime.
 */
export function evaluateReminders(params: EvaluateRemindersParams): EvaluationResult {
  const {
    settings,
    userId,
    dateStr,
    workDay,
    scheduleDay,
    now = new Date(),
    dispatchedIds = new Set<string>(),
  } = params;

  if (!settings.enabled || !userId || !dateStr) {
    return { readyToTrigger: [], upcomingNext: null, allScheduled: [] };
  }

  const allScheduled: ScheduledReminder[] = [];
  const nowMs = now.getTime();

  // -------------------------------------------------------------
  // 1. LEMBRETE DE ENTRADA (ENTRY)
  // -------------------------------------------------------------
  if (
    settings.entryEnabled &&
    scheduleDay &&
    scheduleDay.expectedMinutes > 0 &&
    scheduleDay.plannedStartMinutes !== null &&
    scheduleDay.plannedStartMinutes !== undefined
  ) {
    const isHoliday = Boolean((workDay as any)?.holiday);
    const isOccurrence = Boolean((workDay as any)?.occurrence);
    const hasEntries = (workDay?.entries || []).some(
      (e) => !(e as any).deletedAt && e.type === 'CLOCK_IN'
    );

    if (!isHoliday && !isOccurrence && !hasEntries) {
      const plannedStartDate = parseCivilDateTimeToUtc(
        dateStr,
        scheduleDay.plannedStartMinutes
      );
      const targetStartMs = plannedStartDate.getTime();
      const leadMs = settings.entryLeadMinutes * 60000;
      const triggerAtMs = targetStartMs - leadMs;

      const id = `${userId}_${dateStr}_ENTRY_${scheduleDay.plannedStartMinutes}_${settings.entryLeadMinutes}`;

      allScheduled.push({
        id,
        type: 'ENTRY',
        title: 'Horário de Entrada',
        message: 'Seu horário de entrada está chegando.',
        targetTimeFormatted: formatHHmm(plannedStartDate),
        triggerTimeFormatted: formatHHmm(new Date(triggerAtMs)),
        targetTimeMs: targetStartMs,
        triggerAtMs,
        metadata: {
          plannedStartMinutes: scheduleDay.plannedStartMinutes,
          leadMinutes: settings.entryLeadMinutes,
        },
      });
    }
  }

  // -------------------------------------------------------------
  // 2. LEMBRETE DE RETORNO DO INTERVALO (BREAK_RETURN)
  // -------------------------------------------------------------
  const activeBreak = workDay?.session?.activeBreak;
  const isOnBreak =
    settings.breakEnabled &&
    (workDay?.session?.state === 'ON_SNACK_BREAK' ||
      workDay?.session?.state === 'ON_LUNCH_BREAK' ||
      Boolean(activeBreak));

  if (isOnBreak && activeBreak) {
    let targetReturnMs: number | null = null;

    if (activeBreak.autoResumeAt) {
      targetReturnMs = new Date(activeBreak.autoResumeAt).getTime();
    } else if (activeBreak.plannedDurationMinutes && activeBreak.plannedDurationMinutes > 0) {
      targetReturnMs =
        new Date(activeBreak.startedAt).getTime() + activeBreak.plannedDurationMinutes * 60000;
    } else if (scheduleDay) {
      const dur =
        activeBreak.type === 'LUNCH'
          ? scheduleDay.lunchBreakMinutes
          : scheduleDay.snackBreakMinutes;
      if (dur > 0) {
        targetReturnMs = new Date(activeBreak.startedAt).getTime() + dur * 60000;
      }
    }

    if (targetReturnMs && targetReturnMs > 0) {
      const targetReturnDate = new Date(targetReturnMs);
      const leadMs = settings.breakLeadMinutes * 60000;
      const triggerAtMs = targetReturnMs - leadMs;

      const breakKey = activeBreak.id || activeBreak.type;
      const id = `${userId}_${dateStr}_BREAK_${breakKey}_${Math.floor(targetReturnMs / 60000)}`;

      allScheduled.push({
        id,
        type: 'BREAK_RETURN',
        title: 'Retorno do Intervalo',
        message: 'Seu intervalo está próximo do fim.',
        targetTimeFormatted: formatHHmm(targetReturnDate),
        triggerTimeFormatted: formatHHmm(new Date(triggerAtMs)),
        targetTimeMs: targetReturnMs,
        triggerAtMs,
        metadata: {
          breakType: activeBreak.type,
          leadMinutes: settings.breakLeadMinutes,
        },
      });
    }
  }

  // -------------------------------------------------------------
  // 3. LEMBRETE DE SAÍDA PREVISTA (EXIT)
  // -------------------------------------------------------------
  const predicted = calculatePredictedExit({ workDay, scheduleDay, now });

  if (settings.exitEnabled && predicted && workDay?.isOpen) {
    const targetExitMs = predicted.predictedExitDate.getTime();
    const leadMs = settings.exitLeadMinutes * 60000;
    const triggerAtMs = targetExitMs - leadMs;

    const exitHhMm = formatHHmm(predicted.predictedExitDate);
    const id = `${userId}_${dateStr}_EXIT_${exitHhMm}_${settings.exitLeadMinutes}`;

    allScheduled.push({
      id,
      type: 'EXIT',
      title: 'Saída Prevista',
      message: 'Você está próximo do horário previsto de saída.',
      targetTimeFormatted: exitHhMm,
      triggerTimeFormatted: formatHHmm(new Date(triggerAtMs)),
      targetTimeMs: targetExitMs,
      triggerAtMs,
      metadata: {
        predictedExit: exitHhMm,
        leadMinutes: settings.exitLeadMinutes,
      },
    });
  }

  // -------------------------------------------------------------
  // 4. JORNADA ABERTA ALÉM DO ESPERADO (OVERTIME)
  // -------------------------------------------------------------
  if (settings.overtimeEnabled && predicted && workDay?.isOpen) {
    const targetExitMs = predicted.predictedExitDate.getTime();
    const toleranceMs = settings.overtimeToleranceMinutes * 60000;
    const triggerAtMs = targetExitMs + toleranceMs;
    const overtimeDate = new Date(triggerAtMs);

    const id = `${userId}_${dateStr}_OVERTIME_${settings.overtimeToleranceMinutes}`;

    allScheduled.push({
      id,
      type: 'OVERTIME',
      title: 'Jornada em Andamento',
      message: 'Sua jornada ainda está em andamento. Confira se falta registrar a saída.',
      targetTimeFormatted: formatHHmm(overtimeDate),
      triggerTimeFormatted: formatHHmm(new Date(triggerAtMs)),
      targetTimeMs: targetExitMs,
      triggerAtMs,
      metadata: {
        toleranceMinutes: settings.overtimeToleranceMinutes,
      },
    });
  }

  // -------------------------------------------------------------
  // FILTRAGEM: READY TO TRIGGER vs UPCOMING
  // -------------------------------------------------------------
  const readyToTrigger: ScheduledReminder[] = [];
  const upcomingList: ScheduledReminder[] = [];

  for (const item of allScheduled) {
    // If already dispatched, skip
    if (dispatchedIds.has(item.id)) {
      continue;
    }

    // Check relevance window
    // ENTRY: within 30 min after nominal start
    // BREAK_RETURN: within 10 min after return
    // EXIT: within 15 min after predicted exit
    // OVERTIME: within 180 min after triggerAtMs
    let maxRelevanceMs = item.targetTimeMs + 15 * 60000;
    if (item.type === 'ENTRY') {
      maxRelevanceMs = item.targetTimeMs + 30 * 60000;
    } else if (item.type === 'BREAK_RETURN') {
      maxRelevanceMs = item.targetTimeMs + 10 * 60000;
    } else if (item.type === 'OVERTIME') {
      maxRelevanceMs = item.triggerAtMs + 180 * 60000;
    }

    if (nowMs >= item.triggerAtMs && nowMs <= maxRelevanceMs) {
      readyToTrigger.push(item);
    } else if (nowMs < item.triggerAtMs) {
      upcomingList.push(item);
    }
  }

  // Sort upcoming chronologically to find the very next one
  upcomingList.sort((a, b) => a.triggerAtMs - b.triggerAtMs);
  const upcomingNext = upcomingList[0] || null;

  return {
    readyToTrigger,
    upcomingNext,
    allScheduled,
  };
}

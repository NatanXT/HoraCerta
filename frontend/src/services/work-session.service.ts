import { api } from './api';
import { TimeEntry, WorkBreak } from '../types/work-day';

export type WorkSessionState =
  | 'NOT_STARTED'
  | 'WORKING'
  | 'ON_SNACK_BREAK'
  | 'ON_LUNCH_BREAK'
  | 'ENDED';

export interface ActiveBreak {
  id: string;
  type: 'SNACK' | 'LUNCH';
  startedAt: string;
  elapsedMinutes: number;
  plannedDurationMinutes?: number | null;
  autoResumeAt?: string | null;
  resumedAutomatically?: boolean;
}

export interface AvailableActions {
  start: boolean;
  pauseSnack: boolean;
  pauseLunch: boolean;
  resume: boolean;
  finish: boolean;
}

export interface SessionStatus {
  state: WorkSessionState;
  reconciliationRequired?: boolean;
  activeBreak: ActiveBreak | null;
  availableActions: AvailableActions;
}

export interface BreakSummary {
  snackMinutes: number;
  lunchMinutes: number;
  plannedSnackMinutes: number;
  plannedLunchMinutes: number;
}

export interface WorkDayWithSession {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  currentSessionMinutes: number;
  totalWorkedMinutes: number;
  balanceMinutes: number;
  isOpen: boolean;
  entries: TimeEntry[];
  workBreaks?: WorkBreak[];
  session?: SessionStatus;
  breakSummary?: BreakSummary;
}

export const workSessionService = {
  async getToday(): Promise<WorkDayWithSession> {
    const response = await api.get<WorkDayWithSession>('/api/work-days/today');
    return response.data;
  },

  async startSession(): Promise<WorkDayWithSession> {
    const response = await api.post<WorkDayWithSession>('/api/work-session/start');
    return response.data;
  },

  async pauseSession(type: 'SNACK' | 'LUNCH'): Promise<WorkDayWithSession> {
    const response = await api.post<WorkDayWithSession>('/api/work-session/pause', { type });
    return response.data;
  },

  async resumeSession(): Promise<WorkDayWithSession> {
    const response = await api.post<WorkDayWithSession>('/api/work-session/resume');
    return response.data;
  },

  async finishSession(): Promise<WorkDayWithSession> {
    const response = await api.post<WorkDayWithSession>('/api/work-session/finish');
    return response.data;
  },

  async reconcileSession(): Promise<WorkDayWithSession> {
    const response = await api.post<WorkDayWithSession>('/api/work-session/reconcile');
    return response.data;
  },
};

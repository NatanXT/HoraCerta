import { api } from './api';
import { WorkDaySummary } from '../types/work-day';

export const timeEntryService = {
  async clockIn(): Promise<WorkDaySummary> {
    const response = await api.post<WorkDaySummary>('/api/time-entries/clock-in');
    return response.data;
  },

  async clockOut(): Promise<WorkDaySummary> {
    const response = await api.post<WorkDaySummary>('/api/time-entries/clock-out');
    return response.data;
  },
};

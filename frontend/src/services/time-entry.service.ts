import { api } from './api';
import { WorkDaySummary } from '../types/work-day';
import { inFlightTracker } from '../features/pwa/utils/inFlightTracker';

export const timeEntryService = {
  async clockIn(): Promise<WorkDaySummary> {
    return inFlightTracker.track(async () => {
      const response = await api.post<WorkDaySummary>('/api/time-entries/clock-in');
      return response.data;
    });
  },

  async clockOut(): Promise<WorkDaySummary> {
    return inFlightTracker.track(async () => {
      const response = await api.post<WorkDaySummary>('/api/time-entries/clock-out');
      return response.data;
    });
  },
};

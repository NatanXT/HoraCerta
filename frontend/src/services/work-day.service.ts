import { api } from './api';
import { WorkDaySummary } from '../types/work-day';

export const workDayService = {
  async getTodayWorkDay(): Promise<WorkDaySummary> {
    const response = await api.get<WorkDaySummary>('/api/work-days/today');
    return response.data;
  },
};

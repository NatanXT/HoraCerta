import { api } from './api';
import { WorkDaySummary, MonthlyHistoryResponse } from '../types/work-day';

export const workDayService = {
  async getTodayWorkDay(): Promise<WorkDaySummary> {
    const response = await api.get<WorkDaySummary>('/api/work-days/today');
    return response.data;
  },

  async getMonthlyWorkDays(month: string): Promise<MonthlyHistoryResponse> {
    const response = await api.get<MonthlyHistoryResponse>('/api/work-days/monthly', {
      params: { month },
    });
    return response.data;
  },
};

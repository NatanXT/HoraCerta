import { api } from './api';
import { WorkDaySummary, MonthlyHistoryResponse } from '../types/work-day';
import { WeeklySummaryResponse } from '../types/weekly-summary';

export const workDayService = {
  async getTodayWorkDay(): Promise<WorkDaySummary> {
    const response = await api.get<WorkDaySummary>('/api/work-days/today');
    return response.data;
  },

  async getWeeklySummary(startDate: string): Promise<WeeklySummaryResponse> {
    const response = await api.get<WeeklySummaryResponse>('/api/work-days/weekly-summary', {
      params: { startDate },
    });
    return response.data;
  },

  async getMonthlyWorkDays(month: string): Promise<MonthlyHistoryResponse> {
    const response = await api.get<MonthlyHistoryResponse>('/api/work-days/monthly', {
      params: { month },
    });
    return response.data;
  },
};

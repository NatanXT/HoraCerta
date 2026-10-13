import { api } from './api';
import { Holiday } from '../types/holiday';

export interface SyncHolidaysResponse {
  year: number;
  synced: number;
  holidays: Holiday[];
}

export const holidayService = {
  async syncHolidays(year: number): Promise<SyncHolidaysResponse> {
    const response = await api.post<SyncHolidaysResponse>('/api/holidays/sync', { year });
    return response.data;
  },

  async getHolidays(year: number): Promise<Holiday[]> {
    const response = await api.get<Holiday[]>('/api/holidays', {
      params: { year },
    });
    return response.data;
  },
};

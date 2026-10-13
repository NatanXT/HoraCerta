import { api } from './api';
import { AppearancePreferences } from '../types/appearance';

export const appearanceService = {
  async getPreferences(): Promise<AppearancePreferences> {
    const response = await api.get<AppearancePreferences>('/api/profile/appearance');
    return response.data;
  },

  async updatePreferences(data: AppearancePreferences): Promise<AppearancePreferences> {
    const response = await api.put<AppearancePreferences>('/api/profile/appearance', data);
    return response.data;
  },
};

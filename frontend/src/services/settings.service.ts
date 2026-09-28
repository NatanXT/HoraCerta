import { api } from './api';
import {
  SettingsResponse,
  SettingsProfile,
  SaveProfilePayload,
  SaveWorkSchedulePayload,
} from '../types/settings';

export class SettingsService {
  async getSettings(): Promise<SettingsResponse> {
    const response = await api.get<SettingsResponse>('/api/settings');
    return response.data;
  }

  async saveProfile(payload: SaveProfilePayload): Promise<SettingsProfile> {
    const response = await api.put<SettingsProfile>('/api/settings/profile', payload);
    return response.data;
  }

  async saveWorkSchedule(payload: SaveWorkSchedulePayload): Promise<SettingsResponse> {
    const response = await api.put<SettingsResponse>('/api/settings/work-schedule', payload);
    return response.data;
  }
}

export const settingsService = new SettingsService();

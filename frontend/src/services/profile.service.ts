import { api } from './api';
import { UserDto } from './auth.service';

export interface WorkScheduleDayInput {
  weekday: string;
  expectedMinutes: number;
  plannedStartMinutes?: number | null;
  plannedEndMinutes?: number | null;
  snackBreakMinutes?: number;
  lunchBreakMinutes?: number;
}

export interface ProfileScheduleDay {
  weekday: string;
  expectedMinutes: number;
  plannedStartMinutes: number | null;
  plannedEndMinutes: number | null;
  snackBreakMinutes: number;
  lunchBreakMinutes: number;
}

export interface WorkScheduleProfileDto {
  effectiveFrom: string;
  weeklyExpectedMinutes: number;
  days: ProfileScheduleDay[];
}

export interface ProfileResponseDto {
  user: UserDto;
  timezone: string;
  workSchedule: WorkScheduleProfileDto;
}

export const profileService = {
  async getProfile(): Promise<ProfileResponseDto> {
    const response = await api.get<ProfileResponseDto>('/api/profile');
    return response.data;
  },

  async updatePersonalData(data: { name: string }): Promise<UserDto> {
    const response = await api.put<UserDto>('/api/profile', data);
    return response.data;
  },

  async updateWorkSchedule(days: WorkScheduleDayInput[]): Promise<WorkScheduleProfileDto> {
    const response = await api.put<WorkScheduleProfileDto>('/api/profile/work-schedule', { days });
    return response.data;
  },
};

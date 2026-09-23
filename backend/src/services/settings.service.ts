import { Weekday } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { userRepository } from '../repositories/user.repository';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { getLocalDateString, parseDateToUtcMidnight } from '../utils/date';

export interface ProfileDto {
  name: string;
  email: string;
}

export interface PreferencesDto {
  timezone: string;
}

export interface WorkScheduleDayDto {
  weekday: Weekday;
  expectedMinutes: number;
}

export interface WorkScheduleSettingsDto {
  effectiveFrom: string;
  weeklyExpectedMinutes: number;
  days: WorkScheduleDayDto[];
}

export interface SettingsResponseDto {
  profile: ProfileDto;
  preferences: PreferencesDto;
  workSchedule: WorkScheduleSettingsDto;
}

const WEEKDAY_ORDER: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

export class SettingsService {
  async getSettings(): Promise<SettingsResponseDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const latestVersionDate = await workScheduleRepository.findLatestScheduleVersionDate(user.id);
    const effectiveFromStr = latestVersionDate
      ? latestVersionDate.toISOString().substring(0, 10)
      : '2000-01-01';

    let schedules = latestVersionDate
      ? await workScheduleRepository.findSchedulesByVersionDate(user.id, latestVersionDate)
      : [];

    const scheduleMap = new Map<Weekday, number>();
    for (const s of schedules) {
      scheduleMap.set(s.weekday, s.expectedMinutes);
    }

    const days: WorkScheduleDayDto[] = WEEKDAY_ORDER.map((weekday) => ({
      weekday,
      expectedMinutes: scheduleMap.get(weekday) ?? 0,
    }));

    const weeklyExpectedMinutes = days.reduce((sum, d) => sum + d.expectedMinutes, 0);

    return {
      profile: {
        name: user.name,
        email: user.email,
      },
      preferences: {
        timezone: env.APP_TIMEZONE,
      },
      workSchedule: {
        effectiveFrom: effectiveFromStr,
        weeklyExpectedMinutes,
        days,
      },
    };
  }

  async updateProfile(data: { name: string }): Promise<ProfileDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const updatedUser = await userRepository.updateName(user.id, data.name);

    return {
      name: updatedUser.name,
      email: updatedUser.email,
    };
  }

  async updateWorkSchedule(
    days: { weekday: Weekday; expectedMinutes: number }[]
  ): Promise<SettingsResponseDto> {
    const user = await userRepository.findByEmail(env.DEFAULT_USER_EMAIL);
    if (!user) {
      throw new AppError('Usuário padrão não encontrado.', 404, 'DEFAULT_USER_NOT_FOUND');
    }

    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    const effectiveFromDate = parseDateToUtcMidnight(todayStr);

    await workScheduleRepository.upsertVersionSchedules(user.id, effectiveFromDate, days);

    return this.getSettings();
  }
}

export const settingsService = new SettingsService();

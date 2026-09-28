import { Weekday } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
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
  async getSettings(userId: string): Promise<SettingsResponseDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const err: any = new Error('Usuário não encontrado.');
      err.statusCode = 404;
      throw err;
    }

    const latestVersionDate = await workScheduleRepository.findLatestScheduleVersionDate(user.id);
    const effectiveFromStr = latestVersionDate
      ? latestVersionDate.toISOString().substring(0, 10)
      : getLocalDateString(new Date(), env.APP_TIMEZONE);

    let schedules = latestVersionDate
      ? await workScheduleRepository.findSchedulesByVersionDate(user.id, latestVersionDate)
      : [];

    const scheduleMap = new Map<Weekday, number>();
    for (const s of schedules) {
      scheduleMap.set(s.weekday, s.expectedMinutes);
    }

    const days: WorkScheduleDayDto[] = WEEKDAY_ORDER.map((weekday) => ({
      weekday,
      expectedMinutes:
        scheduleMap.get(weekday) ??
        (weekday === Weekday.SATURDAY || weekday === Weekday.SUNDAY ? 0 : 480),
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

  async updateProfile(userId: string, data: { name: string }): Promise<ProfileDto> {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
    });

    return {
      name: updatedUser.name,
      email: updatedUser.email,
    };
  }

  async updateWorkSchedule(
    userId: string,
    days: { weekday: Weekday; expectedMinutes: number }[]
  ): Promise<SettingsResponseDto> {
    const todayStr = getLocalDateString(new Date(), env.APP_TIMEZONE);
    const effectiveFromDate = parseDateToUtcMidnight(todayStr);

    await workScheduleRepository.upsertVersionSchedules(userId, effectiveFromDate, days);

    return this.getSettings(userId);
  }
}

export const settingsService = new SettingsService();

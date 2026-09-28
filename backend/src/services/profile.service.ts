import { Weekday } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { workScheduleRepository } from '../repositories/work-schedule.repository';
import { getTodayUtcMidnight } from '../utils/date';
import { UpdateProfileInput, UpdateWorkScheduleInput } from '../schemas/profile.schema';
import { AppError } from '../errors/app-error';

const WEEKDAYS_ORDER: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

export interface WorkScheduleDayDTO {
  weekday: Weekday;
  isWorkDay: boolean;
  expectedMinutes: number;
  plannedStartMinutes: number | null;
  plannedEndMinutes: number | null;
  snackBreakMinutes: number;
  lunchBreakMinutes: number;
}

export interface ProfileResponseDTO {
  user: {
    id: string;
    name: string;
    email: string;
  };
  timezone: string;
  workSchedule: {
    effectiveFrom: string;
    weeklyWorkloadMinutes: number;
    days: WorkScheduleDayDTO[];
  };
}

export class ProfileService {
  async getProfile(userId: string): Promise<ProfileResponseDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    const todayUtc = getTodayUtcMidnight();
    let versionDate = await workScheduleRepository.findLatestScheduleVersionDate(userId);

    if (!versionDate) {
      // Default initial 480m Mon-Fri schedule
      versionDate = todayUtc;
      const defaultDays = WEEKDAYS_ORDER.map((weekday) => {
        const isWeekday = weekday !== Weekday.SATURDAY && weekday !== Weekday.SUNDAY;
        return {
          weekday,
          expectedMinutes: isWeekday ? 480 : 0,
          plannedStartMinutes: isWeekday ? 480 : null, // 08:00
          plannedEndMinutes: isWeekday ? 1035 : null, // 17:15
          snackBreakMinutes: isWeekday ? 15 : 0,
          lunchBreakMinutes: isWeekday ? 60 : 0,
        };
      });
      await workScheduleRepository.upsertVersionSchedules(userId, versionDate, defaultDays);
    }

    const schedules = await workScheduleRepository.findSchedulesByVersionDate(userId, versionDate);
    const scheduleMap = new Map(schedules.map((s) => [s.weekday, s]));

    const daysDTO: WorkScheduleDayDTO[] = WEEKDAYS_ORDER.map((weekday) => {
      const found = scheduleMap.get(weekday);
      const expectedMinutes = found ? found.expectedMinutes : 0;
      const plannedStartMinutes = found?.plannedStartMinutes ?? (expectedMinutes > 0 ? 480 : null);
      const plannedEndMinutes = found?.plannedEndMinutes ?? (expectedMinutes > 0 ? 1035 : null);
      const snackBreakMinutes = found?.snackBreakMinutes ?? 0;
      const lunchBreakMinutes = found?.lunchBreakMinutes ?? (expectedMinutes > 0 ? 60 : 0);
      const isWorkDay = expectedMinutes > 0 || (plannedStartMinutes !== null && plannedEndMinutes !== null);

      return {
        weekday,
        isWorkDay,
        expectedMinutes,
        plannedStartMinutes,
        plannedEndMinutes,
        snackBreakMinutes,
        lunchBreakMinutes,
      };
    });

    const weeklyWorkloadMinutes = daysDTO.reduce((acc, curr) => acc + curr.expectedMinutes, 0);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      timezone: env.APP_TIMEZONE,
      workSchedule: {
        effectiveFrom: versionDate.toISOString().substring(0, 10),
        weeklyWorkloadMinutes,
        days: daysDTO,
      },
    };
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<ProfileResponseDTO> {
    await prisma.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
    });

    return this.getProfile(userId);
  }

  async updateWorkSchedule(userId: string, data: UpdateWorkScheduleInput): Promise<ProfileResponseDTO> {
    const todayUtc = getTodayUtcMidnight();
    const validatedDays: {
      weekday: Weekday;
      expectedMinutes: number;
      plannedStartMinutes: number | null;
      plannedEndMinutes: number | null;
      snackBreakMinutes: number;
      lunchBreakMinutes: number;
    }[] = [];

    for (const day of data.days) {
      if (day.isWorkDay) {
        if (
          day.plannedStartMinutes === null ||
          day.plannedStartMinutes === undefined ||
          day.plannedEndMinutes === null ||
          day.plannedEndMinutes === undefined
        ) {
          throw new AppError(
            `Horários de início e fim são obrigatórios para ${day.weekday}.`,
            400,
            'INVALID_WORK_SCHEDULE'
          );
        }

        if (day.plannedStartMinutes >= day.plannedEndMinutes) {
          throw new AppError(
            `Horário de início deve ser anterior ao fim em ${day.weekday}.`,
            400,
            'INVALID_WORK_SCHEDULE'
          );
        }

        const totalSpan = day.plannedEndMinutes - day.plannedStartMinutes;
        const totalBreaks = (day.snackBreakMinutes || 0) + (day.lunchBreakMinutes || 0);

        if (totalBreaks >= totalSpan) {
          throw new AppError(
            `Tempo total de pausas (${totalBreaks}m) não pode exceder a duração do expediente (${totalSpan}m) em ${day.weekday}.`,
            400,
            'INVALID_WORK_SCHEDULE'
          );
        }

        const expectedMinutes = totalSpan - totalBreaks;
        if (expectedMinutes <= 0) {
          throw new AppError(
            `Jornada líquida em ${day.weekday} deve ser maior que 0 minutos.`,
            400,
            'INVALID_WORK_SCHEDULE'
          );
        }

        validatedDays.push({
          weekday: day.weekday,
          expectedMinutes,
          plannedStartMinutes: day.plannedStartMinutes,
          plannedEndMinutes: day.plannedEndMinutes,
          snackBreakMinutes: day.snackBreakMinutes || 0,
          lunchBreakMinutes: day.lunchBreakMinutes || 0,
        });
      } else {
        validatedDays.push({
          weekday: day.weekday,
          expectedMinutes: 0,
          plannedStartMinutes: null,
          plannedEndMinutes: null,
          snackBreakMinutes: 0,
          lunchBreakMinutes: 0,
        });
      }
    }

    // Save as new version with effectiveFrom = todayUtc
    await workScheduleRepository.upsertVersionSchedules(userId, todayUtc, validatedDays);

    return this.getProfile(userId);
  }
}

export const profileService = new ProfileService();

import { WorkSchedule, Weekday } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class WorkScheduleRepository {
  async findByUserAndWeekday(
    userId: string,
    weekday: Weekday
  ): Promise<WorkSchedule | null> {
    return prisma.workSchedule.findUnique({
      where: {
        userId_weekday: {
          userId,
          weekday,
        },
      },
    });
  }

  async findAllByUser(userId: string): Promise<WorkSchedule[]> {
    return prisma.workSchedule.findMany({
      where: { userId },
    });
  }
}

export const workScheduleRepository = new WorkScheduleRepository();

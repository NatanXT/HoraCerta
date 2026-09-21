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
}

export const workScheduleRepository = new WorkScheduleRepository();

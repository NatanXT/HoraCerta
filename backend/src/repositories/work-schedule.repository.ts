import { WorkSchedule, Weekday, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class WorkScheduleRepository {
  async findByUserAndWeekday(
    userId: string,
    weekday: Weekday,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<WorkSchedule | null> {
    return db.workSchedule.findUnique({
      where: {
        userId_weekday: {
          userId,
          weekday,
        },
      },
    });
  }

  async findAllByUser(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<WorkSchedule[]> {
    return db.workSchedule.findMany({
      where: { userId },
    });
  }
}

export const workScheduleRepository = new WorkScheduleRepository();

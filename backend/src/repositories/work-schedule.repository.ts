import { WorkSchedule, Weekday, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class WorkScheduleRepository {
  async findEffectiveByUserWeekdayAndDate(
    userId: string,
    weekday: Weekday,
    date: Date,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<WorkSchedule | null> {
    return db.workSchedule.findFirst({
      where: {
        userId,
        weekday,
        effectiveFrom: {
          lte: date,
        },
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
    });
  }

  async findAllVersionsByUserUntilDate(
    userId: string,
    endDate: Date,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<WorkSchedule[]> {
    return db.workSchedule.findMany({
      where: {
        userId,
        effectiveFrom: {
          lte: endDate,
        },
      },
      orderBy: {
        effectiveFrom: 'asc',
      },
    });
  }

  async findLatestScheduleVersionDate(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<Date | null> {
    const latest = await db.workSchedule.findFirst({
      where: { userId },
      orderBy: { effectiveFrom: 'desc' },
      select: { effectiveFrom: true },
    });
    return latest ? latest.effectiveFrom : null;
  }

  async findSchedulesByVersionDate(
    userId: string,
    effectiveFrom: Date,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<WorkSchedule[]> {
    return db.workSchedule.findMany({
      where: {
        userId,
        effectiveFrom,
      },
      orderBy: {
        weekday: 'asc',
      },
    });
  }

  async upsertVersionSchedules(
    userId: string,
    effectiveFrom: Date,
    days: { weekday: Weekday; expectedMinutes: number }[]
  ): Promise<WorkSchedule[]> {
    return prisma.$transaction(async (tx) => {
      const results: WorkSchedule[] = [];
      for (const day of days) {
        const schedule = await tx.workSchedule.upsert({
          where: {
            userId_weekday_effectiveFrom: {
              userId,
              weekday: day.weekday,
              effectiveFrom,
            },
          },
          update: {
            expectedMinutes: day.expectedMinutes,
          },
          create: {
            userId,
            weekday: day.weekday,
            expectedMinutes: day.expectedMinutes,
            effectiveFrom,
          },
        });
        results.push(schedule);
      }
      return results;
    });
  }
}

export const workScheduleRepository = new WorkScheduleRepository();

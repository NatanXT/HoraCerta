import { WorkDay, TimeEntry, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type WorkDayWithEntries = WorkDay & {
  timeEntries: TimeEntry[];
};

export class WorkDayRepository {
  async findByUserAndDate(
    userId: string,
    date: Date,
    tx: Prisma.TransactionClient = prisma
  ): Promise<WorkDayWithEntries | null> {
    return tx.workDay.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      include: {
        timeEntries: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });
  }

  async findByUserAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    tx: Prisma.TransactionClient = prisma
  ): Promise<WorkDayWithEntries[]> {
    return tx.workDay.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        timeEntries: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async findOldestByUser(
    userId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<WorkDayWithEntries | null> {
    return tx.workDay.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      include: {
        timeEntries: {
          where: {
            deletedAt: null,
          },
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  }

  async findOrCreateByUserAndDate(
    userId: string,
    date: Date,
    expectedMinutesSnapshot: number | null = null,
    tx: Prisma.TransactionClient = prisma
  ): Promise<WorkDayWithEntries> {
    const existing = await this.findByUserAndDate(userId, date, tx);
    if (existing) {
      if (existing.expectedMinutesSnapshot === null && expectedMinutesSnapshot !== null) {
        // Update snapshot fallback for older WorkDays
        await tx.workDay.update({
          where: { id: existing.id },
          data: { expectedMinutesSnapshot },
        });
        existing.expectedMinutesSnapshot = expectedMinutesSnapshot;
      }
      return existing;
    }

    const created = await tx.workDay.create({
      data: {
        userId,
        date,
        expectedMinutesSnapshot,
      },
      include: {
        timeEntries: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return created;
  }
}

export const workDayRepository = new WorkDayRepository();

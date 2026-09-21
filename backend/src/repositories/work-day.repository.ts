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
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });
  }

  async findOrCreateByUserAndDate(
    userId: string,
    date: Date,
    tx: Prisma.TransactionClient = prisma
  ): Promise<WorkDayWithEntries> {
    const existing = await this.findByUserAndDate(userId, date, tx);
    if (existing) {
      return existing;
    }

    const created = await tx.workDay.create({
      data: {
        userId,
        date,
      },
      include: {
        timeEntries: {
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

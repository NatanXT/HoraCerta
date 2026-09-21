import { TimeEntry, TimeEntryType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class TimeEntryRepository {
  async create(
    workDayId: string,
    type: TimeEntryType,
    timestamp: Date,
    tx: Prisma.TransactionClient = prisma
  ): Promise<TimeEntry> {
    return tx.timeEntry.create({
      data: {
        workDayId,
        type,
        timestamp,
      },
    });
  }
}

export const timeEntryRepository = new TimeEntryRepository();

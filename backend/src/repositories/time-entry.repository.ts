import { TimeEntry, TimeEntryType, TimeEntrySource, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class TimeEntryRepository {
  async create(
    workDayId: string,
    type: TimeEntryType,
    timestamp: Date,
    tx: Prisma.TransactionClient = prisma,
    source: TimeEntrySource = TimeEntrySource.CLOCK
  ): Promise<TimeEntry> {
    return tx.timeEntry.create({
      data: {
        workDayId,
        type,
        timestamp,
        source,
      },
    });
  }

  async findActiveByWorkDayId(
    workDayId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<TimeEntry[]> {
    return tx.timeEntry.findMany({
      where: {
        workDayId,
        deletedAt: null,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  async softDeleteActiveByWorkDayId(
    workDayId: string,
    deletedAt: Date = new Date(),
    tx: Prisma.TransactionClient = prisma
  ): Promise<Prisma.BatchPayload> {
    return tx.timeEntry.updateMany({
      where: {
        workDayId,
        deletedAt: null,
      },
      data: {
        deletedAt,
      },
    });
  }

  async createManyManual(
    workDayId: string,
    entries: { type: TimeEntryType; timestamp: Date }[],
    tx: Prisma.TransactionClient = prisma
  ): Promise<TimeEntry[]> {
    const created: TimeEntry[] = [];
    for (const entry of entries) {
      const te = await tx.timeEntry.create({
        data: {
          workDayId,
          type: entry.type,
          timestamp: entry.timestamp,
          source: TimeEntrySource.MANUAL,
          deletedAt: null,
        },
      });
      created.push(te);
    }
    return created;
  }
}

export const timeEntryRepository = new TimeEntryRepository();

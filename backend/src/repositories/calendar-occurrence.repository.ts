import { CalendarOccurrence, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class CalendarOccurrenceRepository {
  async findById(id: string, userId: string): Promise<CalendarOccurrence | null> {
    return prisma.calendarOccurrence.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });
  }

  async findActiveInRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarOccurrence[]> {
    return prisma.calendarOccurrence.findMany({
      where: {
        userId,
        deletedAt: null,
        startDate: {
          lte: endDate,
        },
        endDate: {
          gte: startDate,
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findConflicting(
    tx: Prisma.TransactionClient | typeof prisma,
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string
  ): Promise<CalendarOccurrence | null> {
    const where: Prisma.CalendarOccurrenceWhereInput = {
      userId,
      deletedAt: null,
      startDate: {
        lte: endDate,
      },
      endDate: {
        gte: startDate,
      },
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    return tx.calendarOccurrence.findFirst({ where });
  }

  async create(
    tx: Prisma.TransactionClient | typeof prisma,
    data: Prisma.CalendarOccurrenceUncheckedCreateInput
  ): Promise<CalendarOccurrence> {
    return tx.calendarOccurrence.create({ data });
  }

  async update(
    tx: Prisma.TransactionClient | typeof prisma,
    id: string,
    userId: string,
    data: Prisma.CalendarOccurrenceUncheckedUpdateInput
  ): Promise<CalendarOccurrence> {
    const existing = await tx.calendarOccurrence.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      throw new Error('Occurrence not found or already deleted');
    }
    return tx.calendarOccurrence.update({
      where: { id },
      data,
    });
  }

  async softDelete(userId: string, id: string): Promise<CalendarOccurrence> {
    const existing = await prisma.calendarOccurrence.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      throw new Error('Occurrence not found or already deleted');
    }
    return prisma.calendarOccurrence.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const calendarOccurrenceRepository = new CalendarOccurrenceRepository();

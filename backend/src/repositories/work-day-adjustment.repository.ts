import { WorkDayAdjustment, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class WorkDayAdjustmentRepository {
  async create(
    workDayId: string,
    reason: string,
    beforeEntries: Prisma.InputJsonValue,
    afterEntries: Prisma.InputJsonValue,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<WorkDayAdjustment> {
    return db.workDayAdjustment.create({
      data: {
        workDayId,
        reason,
        beforeEntries,
        afterEntries,
      },
    });
  }

  async findByWorkDayId(
    workDayId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<WorkDayAdjustment[]> {
    return db.workDayAdjustment.findMany({
      where: { workDayId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const workDayAdjustmentRepository = new WorkDayAdjustmentRepository();

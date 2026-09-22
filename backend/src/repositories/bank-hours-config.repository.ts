import { BankHoursConfig, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class BankHoursConfigRepository {
  async findByUserId(
    userId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<BankHoursConfig | null> {
    return tx.bankHoursConfig.findUnique({
      where: { userId },
    });
  }

  async upsert(
    userId: string,
    startDate: Date,
    initialBalanceMinutes: number,
    tx: Prisma.TransactionClient = prisma
  ): Promise<BankHoursConfig> {
    return tx.bankHoursConfig.upsert({
      where: { userId },
      create: {
        userId,
        startDate,
        initialBalanceMinutes,
      },
      update: {
        startDate,
        initialBalanceMinutes,
      },
    });
  }
}

export const bankHoursConfigRepository = new BankHoursConfigRepository();

import { Holiday } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface UpsertHolidayData {
  date: Date;
  year: number;
  name: string;
  provider: string;
  providerKey: string;
}

export class HolidayRepository {
  async findByYear(year: number): Promise<Holiday[]> {
    if (!prisma.holiday) return [];
    return prisma.holiday.findMany({
      where: { year },
      orderBy: { date: 'asc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Holiday[]> {
    if (!prisma.holiday) return [];
    return prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async findByProviderKey(providerKey: string): Promise<Holiday | null> {
    if (!prisma.holiday) return null;
    return prisma.holiday.findUnique({
      where: { providerKey },
    });
  }

  async upsert(data: UpsertHolidayData): Promise<Holiday> {
    const now = new Date();
    return prisma.holiday.upsert({
      where: { providerKey: data.providerKey },
      update: {
        name: data.name,
        syncedAt: now,
      },
      create: {
        date: data.date,
        year: data.year,
        name: data.name,
        provider: data.provider,
        providerKey: data.providerKey,
        syncedAt: now,
      },
    });
  }

  async upsertMany(items: UpsertHolidayData[]): Promise<Holiday[]> {
    if (items.length === 0) {
      return [];
    }

    const now = new Date();
    const results = await prisma.$transaction(
      items.map((item) =>
        prisma.holiday.upsert({
          where: { providerKey: item.providerKey },
          update: {
            name: item.name,
            syncedAt: now,
          },
          create: {
            date: item.date,
            year: item.year,
            name: item.name,
            provider: item.provider,
            providerKey: item.providerKey,
            syncedAt: now,
          },
        })
      )
    );

    return results.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

export const holidayRepository = new HolidayRepository();

import { prisma } from '../lib/prisma';
import { ThemeMode } from '@prisma/client';
import { AppearanceFavorite } from '../types/appearance.dto';

export class AppearanceRepository {
  async findByUserId(userId: string) {
    if (!prisma.userAppearancePreference) return null;
    return prisma.userAppearancePreference.findUnique({
      where: { userId },
    });
  }

  async upsert(userId: string, data: { mode: ThemeMode; accentHex: string; favorites: AppearanceFavorite[] }) {
    if (!prisma.userAppearancePreference) return null;
    return prisma.userAppearancePreference.upsert({
      where: { userId },
      update: {
        mode: data.mode,
        accentHex: data.accentHex,
        favorites: data.favorites as any,
      },
      create: {
        userId,
        mode: data.mode,
        accentHex: data.accentHex,
        favorites: data.favorites as any,
      },
    });
  }
}

export const appearanceRepository = new AppearanceRepository();

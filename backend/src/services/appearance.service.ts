import { appearanceRepository, AppearanceRepository } from '../repositories/appearance.repository';
import {
  AppearancePreferencesDTO,
  DEFAULT_ACCENT_HEX,
  DEFAULT_FAVORITES,
  DEFAULT_THEME_MODE,
} from '../types/appearance.dto';
import { UpdateAppearanceInput } from '../schemas/appearance.schema';
import { normalizeHex } from '../utils/color-contrast';
import { ThemeMode } from '@prisma/client';

export class AppearanceService {
  constructor(private readonly repository: AppearanceRepository = appearanceRepository) {}

  async getPreferences(userId: string): Promise<AppearancePreferencesDTO> {
    const pref = await this.repository.findByUserId(userId);

    if (!pref) {
      return {
        mode: DEFAULT_THEME_MODE,
        accentHex: DEFAULT_ACCENT_HEX,
        favorites: DEFAULT_FAVORITES,
      };
    }

    return {
      mode: pref.mode as 'LIGHT' | 'DARK',
      accentHex: pref.accentHex,
      favorites: (pref.favorites as any) || DEFAULT_FAVORITES,
    };
  }

  async updatePreferences(userId: string, input: UpdateAppearanceInput): Promise<AppearancePreferencesDTO> {
    const normalizedAccent = normalizeHex(input.accentHex) || DEFAULT_ACCENT_HEX;

    const normalizedFavorites = input.favorites.map((fav, index) => ({
      id: fav.id || String(index + 1),
      name: fav.name.trim(),
      hex: normalizeHex(fav.hex) || DEFAULT_FAVORITES[index]?.hex || DEFAULT_ACCENT_HEX,
    }));

    const updated = await this.repository.upsert(userId, {
      mode: input.mode as ThemeMode,
      accentHex: normalizedAccent,
      favorites: normalizedFavorites,
    });

    if (!updated) {
      return {
        mode: input.mode,
        accentHex: normalizedAccent,
        favorites: normalizedFavorites,
      };
    }

    return {
      mode: updated.mode as 'LIGHT' | 'DARK',
      accentHex: updated.accentHex,
      favorites: (updated.favorites as any) || normalizedFavorites,
    };
  }
}

export const appearanceService = new AppearanceService();

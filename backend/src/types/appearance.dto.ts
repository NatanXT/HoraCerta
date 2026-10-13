export interface AppearanceFavorite {
  id: string;
  name: string;
  hex: string;
}

export type ThemeMode = 'LIGHT' | 'DARK';

export interface AppearancePreferencesDTO {
  mode: ThemeMode;
  accentHex: string;
  favorites: AppearanceFavorite[];
}

export const DEFAULT_THEME_MODE: ThemeMode = 'DARK';
export const DEFAULT_ACCENT_HEX = '#4F46E5';

export const DEFAULT_FAVORITES: AppearanceFavorite[] = [
  { id: '1', name: 'Azul', hex: '#2563EB' },
  { id: '2', name: 'Violeta', hex: '#4F46E5' },
  { id: '3', name: 'Ciano', hex: '#0891B2' },
  { id: '4', name: 'Esmeralda', hex: '#059669' },
  { id: '5', name: 'Âmbar', hex: '#D97706' },
  { id: '6', name: 'Laranja', hex: '#EA580C' },
  { id: '7', name: 'Vermelho', hex: '#DC2626' },
  { id: '8', name: 'Rosa', hex: '#DB2777' },
  { id: '9', name: 'Meia-noite', hex: '#0F172A' },
];

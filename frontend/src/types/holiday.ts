export type HolidayType = 'national' | 'state' | 'municipal' | string;

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type?: HolidayType;
  source: 'BRASIL_API';
}

/**
 * Retorna o rótulo descritivo oficial de acordo com a classificação do feriado:
 * - 'national' | 'nacional' -> 'Feriado Nacional'
 * - 'state' | 'estadual' -> 'Feriado Estadual'
 * - 'municipal' -> 'Feriado Municipal'
 * - Default/ausente -> 'Feriado Nacional'
 */
export function formatHolidayTypeLabel(type?: string | null): string {
  if (!type) return 'Feriado Nacional';
  const normalized = type.trim().toLowerCase();
  if (normalized === 'national' || normalized === 'nacional') return 'Feriado Nacional';
  if (normalized === 'state' || normalized === 'estadual') return 'Feriado Estadual';
  if (normalized === 'municipal') return 'Feriado Municipal';
  return `Feriado ${type.charAt(0).toUpperCase() + type.slice(1)}`;
}

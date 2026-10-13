import { Holiday } from '@prisma/client';

export interface HolidayDTO {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  source: 'BRASIL_API';
}

export function formatHolidayDTO(holiday: Holiday | null | undefined): HolidayDTO | null {
  if (!holiday) return null;
  const dateStr =
    holiday.date instanceof Date
      ? holiday.date.toISOString().substring(0, 10)
      : String(holiday.date).substring(0, 10);

  return {
    id: holiday.id,
    date: dateStr,
    name: holiday.name,
    source: 'BRASIL_API',
  };
}

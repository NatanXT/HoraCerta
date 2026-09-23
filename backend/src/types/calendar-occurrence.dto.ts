import { CalendarOccurrence } from '@prisma/client';

export interface CalendarOccurrenceDTO {
  id: string;
  type: string;
  title: string;
  startDate: string;
  endDate: string;
  note: string | null;
}

export function formatCalendarOccurrenceDTO(
  occ: CalendarOccurrence | null
): CalendarOccurrenceDTO | null {
  if (!occ || occ.deletedAt !== null) return null;
  const startDateStr =
    occ.startDate instanceof Date
      ? occ.startDate.toISOString().substring(0, 10)
      : String(occ.startDate).substring(0, 10);
  const endDateStr =
    occ.endDate instanceof Date
      ? occ.endDate.toISOString().substring(0, 10)
      : String(occ.endDate).substring(0, 10);

  return {
    id: occ.id,
    type: occ.type,
    title: occ.title,
    startDate: startDateStr,
    endDate: endDateStr,
    note: occ.note,
  };
}

export type CalendarOccurrenceType =
  | 'HOLIDAY'
  | 'VACATION'
  | 'MEDICAL_LEAVE'
  | 'JUSTIFIED_ABSENCE'
  | 'EXCEPTIONAL_DAY_OFF';

export interface CalendarOccurrence {
  id: string;
  type: CalendarOccurrenceType;
  title: string;
  startDate: string;
  endDate: string;
  note: string | null;
}

export interface CreateCalendarOccurrenceInput {
  type: CalendarOccurrenceType;
  title: string;
  startDate: string;
  endDate: string;
  note?: string;
}

export interface UpdateCalendarOccurrenceInput {
  type: CalendarOccurrenceType;
  title: string;
  startDate: string;
  endDate: string;
  note?: string;
}

export const CALENDAR_OCCURRENCE_TYPE_LABELS: Record<CalendarOccurrenceType, string> = {
  HOLIDAY: 'Feriado',
  VACATION: 'Férias',
  MEDICAL_LEAVE: 'Atestado / afastamento médico',
  JUSTIFIED_ABSENCE: 'Ausência justificada',
  EXCEPTIONAL_DAY_OFF: 'Folga excepcional',
};

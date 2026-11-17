import { api } from './api';
import {
  CalendarOccurrence,
  CreateCalendarOccurrenceInput,
  UpdateCalendarOccurrenceInput,
} from '../types/calendar-occurrence';
import { inFlightTracker } from '../features/pwa/utils/inFlightTracker';

export const calendarOccurrenceService = {
  async getOccurrences(from: string, to: string): Promise<CalendarOccurrence[]> {
    const response = await api.get<CalendarOccurrence[]>('/api/calendar-occurrences', {
      params: { from, to },
    });
    return response.data;
  },

  async createOccurrence(data: CreateCalendarOccurrenceInput): Promise<CalendarOccurrence> {
    return inFlightTracker.track(async () => {
      const response = await api.post<CalendarOccurrence>('/api/calendar-occurrences', data);
      return response.data;
    });
  },

  async updateOccurrence(
    id: string,
    data: UpdateCalendarOccurrenceInput
  ): Promise<CalendarOccurrence> {
    return inFlightTracker.track(async () => {
      const response = await api.put<CalendarOccurrence>(`/api/calendar-occurrences/${id}`, data);
      return response.data;
    });
  },

  async deleteOccurrence(id: string): Promise<void> {
    return inFlightTracker.track(async () => {
      await api.delete(`/api/calendar-occurrences/${id}`);
    });
  },
};

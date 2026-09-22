import { api } from './api';
import {
  ManualAdjustmentPayload,
  ManualAdjustmentResponse,
  WorkDayAdjustmentsResponse,
} from '../types/manual-adjustment';

export const manualAdjustmentService = {
  async getAdjustments(date: string): Promise<WorkDayAdjustmentsResponse> {
    const response = await api.get<WorkDayAdjustmentsResponse>(`/api/work-days/${date}/adjustments`);
    return response.data;
  },

  async saveAdjustment(
    date: string,
    payload: ManualAdjustmentPayload
  ): Promise<ManualAdjustmentResponse> {
    const response = await api.put<ManualAdjustmentResponse>(
      `/api/work-days/${date}/manual-adjustment`,
      payload
    );
    return response.data;
  },
};

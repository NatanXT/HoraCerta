import { api } from './api';
import { BankHoursResponse } from '../types/bank-hours';

export interface SaveBankHoursConfigParams {
  startDate: string;
  initialBalanceMinutes: number;
}

export const bankHoursService = {
  async getBankHours(): Promise<BankHoursResponse> {
    const response = await api.get<BankHoursResponse>('/api/bank-hours');
    return response.data;
  },

  async saveBankHoursConfig(params: SaveBankHoursConfigParams): Promise<BankHoursResponse> {
    const response = await api.put<BankHoursResponse>('/api/bank-hours/config', params);
    return response.data;
  },
};

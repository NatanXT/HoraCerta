import { api } from './api';
import { WorkHoursReport } from '../types/report';

export const reportService = {
  async getWorkHoursReport(from: string, to: string): Promise<WorkHoursReport> {
    const response = await api.get<WorkHoursReport>('/api/reports/work-hours', {
      params: { from, to },
    });
    return response.data;
  },

  async downloadWorkHoursCsv(from: string, to: string): Promise<void> {
    const response = await api.get('/api/reports/work-hours.csv', {
      params: { from, to },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `horacerta-relatorio-${from}-a-${to}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

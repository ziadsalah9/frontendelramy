import api from './client';
import type { DemandReport, SalesReport } from '@/types';

export const reportsService = {
  /** Inclusive yyyy-MM-dd range, at most one year. ADMIN-only. */
  async get(from: string, to: string): Promise<SalesReport> {
    const { data } = await api.get<SalesReport>('/api/reports', { params: { from, to } });
    return data;
  },
  /** Sales and demand per colour/size over the last `days` days. */
  async demand(days: number): Promise<DemandReport> {
    const { data } = await api.get<DemandReport>('/api/reports/demand', { params: { days } });
    return data;
  },
};

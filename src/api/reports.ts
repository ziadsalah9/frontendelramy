import api from './client';
import type { SalesReport } from '@/types';

export const reportsService = {
  /** Inclusive yyyy-MM-dd range, at most one year. ADMIN-only. */
  async get(from: string, to: string): Promise<SalesReport> {
    const { data } = await api.get<SalesReport>('/api/reports', { params: { from, to } });
    return data;
  },
};

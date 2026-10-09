import api from './client';

export interface DashboardSummary {
  products: number;
  customers: number;
  salesInvoices: number;
  /** null for employees. */
  purchaseInvoices: number | null;
  todaySalesCount: number;
  todaySalesTotal: number;
  recentSales: { id: number; invoiceNumber: string; customerName?: string | null; total: number; remaining: number; createdAt: string }[];
}

export const dashboardService = {
  async get(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/api/dashboard');
    return data;
  },
};

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
  /** Admin only (null for employees). */
  todayProfit: number | null;
  /** What should be in the drawer now. */
  expectedCash: number;
  cashClosedToday: boolean;
  /** Yesterday had sales but no cash closing. */
  unclosedYesterday: boolean;
  /** Unpaid installments due today or earlier. */
  dueInstallmentsCount: number;
  dueInstallmentsAmount: number;
  last7Days: { date: string; count: number; total: number }[];
}

export const dashboardService = {
  async get(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>('/api/dashboard');
    return data;
  },
};

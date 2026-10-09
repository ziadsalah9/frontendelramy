import api from './client';

export interface CashClosingSummary {
  branchId: number;
  branchName: string;
  cashSalesTotal: number;
  countedTotal: number;
  difference: number;
  count5: number;
  count10: number;
  count20: number;
  count50: number;
  count100: number;
  count200: number;
}

export interface CashClosingResponse {
  id: number;
  branchId: number;
  branchName: string;
  closedById?: number;
  closedByName?: string;
  closingDate: string;
  count5: number;
  count10: number;
  count20: number;
  count50: number;
  count100: number;
  count200: number;
  cashSalesTotal: number;
  countedTotal: number;
  difference: number;
  notes?: string;
  createdAt: string;
}

export interface CashClosingRequest {
  branchId: number;
  closingDate?: string;
  count5?: number;
  count10?: number;
  count20?: number;
  count50?: number;
  count100?: number;
  count200?: number;
  notes?: string;
}

export const cashClosingsService = {
  async getSummary(branchId: number, closingDate?: string): Promise<CashClosingSummary> {
    const { data } = await api.get<CashClosingSummary>(`/api/cash-closings/branches/${branchId}/summary`, {
      params: closingDate ? { closingDate } : undefined,
    });
    return data;
  },
  async close(request: CashClosingRequest): Promise<CashClosingResponse> {
    const { data } = await api.post<CashClosingResponse>('/api/cash-closings', request);
    return data;
  },
  /** All closings across branches (ADMIN only). */
  async getAll(): Promise<CashClosingResponse[]> {
    const { data } = await api.get<CashClosingResponse[]>('/api/cash-closings');
    return data;
  },
  /** Closings of one branch (an employee may only ask for their own). */
  async getByBranch(branchId: number): Promise<CashClosingResponse[]> {
    const { data } = await api.get<CashClosingResponse[]>(`/api/cash-closings/branches/${branchId}`);
    return data;
  },
  async getByBranchAndDate(branchId: number, closingDate: string): Promise<CashClosingResponse> {
    const { data } = await api.get<CashClosingResponse>(`/api/cash-closings/branches/${branchId}/dates/${closingDate}`);
    return data;
  },
};

import api from './client';
import type { StockAdjustment, StockAdjustmentCreateInput } from '@/types';

export const stockAdjustmentsService = {
  async getAll(): Promise<StockAdjustment[]> {
    const { data } = await api.get<StockAdjustment[]>('/api/stock-adjustments');
    return data;
  },
  async getById(id: number): Promise<StockAdjustment> {
    const { data } = await api.get<StockAdjustment>(`/api/stock-adjustments/${id}`);
    return data;
  },
  async create(input: StockAdjustmentCreateInput): Promise<StockAdjustment> {
    const { data } = await api.post<StockAdjustment>('/api/stock-adjustments', input);
    return data;
  },
};

import api from './client';
import type { Stock, StockTransaction } from '@/types';

export const stockService = {
  async getById(id: number): Promise<Stock> {
    const { data } = await api.get<Stock>(`/api/stock/${id}`);
    return data;
  },
  async getByProductAndBranch(productId: number, branchId: number): Promise<Stock> {
    const { data } = await api.get<Stock>(`/api/stock/product/${productId}/branch/${branchId}`);
    return data;
  },
  async getTransactionsByStock(stockId: number): Promise<StockTransaction[]> {
    const { data } = await api.get<StockTransaction[]>(`/api/stock/${stockId}/transactions`);
    return data;
  },
  async getTransactionsByProduct(productId: number): Promise<StockTransaction[]> {
    const { data } = await api.get<StockTransaction[]>(`/api/stock/product/${productId}/transactions`);
    return data;
  },
  async getTransactionsByBranch(branchId: number): Promise<StockTransaction[]> {
    const { data } = await api.get<StockTransaction[]>(`/api/stock/branch/${branchId}/transactions`);
    return data;
  },
};

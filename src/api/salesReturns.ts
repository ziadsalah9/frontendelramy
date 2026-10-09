import api from './client';
import type { RefundMethod, SalesReturn } from '@/types';

export const salesReturnsService = {
  /** ADMIN-only. */
  async create(invoiceId: number, input: { items: { invoiceItemId: number; quantity: number }[]; refundMethod: RefundMethod; reason?: string }): Promise<SalesReturn> {
    const { data } = await api.post<SalesReturn>(`/api/sales-invoices/${invoiceId}/returns`, input);
    return data;
  },
  async forInvoice(invoiceId: number): Promise<SalesReturn[]> {
    const { data } = await api.get<SalesReturn[]>(`/api/sales-invoices/${invoiceId}/returns`);
    return data;
  },
  async getAll(): Promise<SalesReturn[]> {
    const { data } = await api.get<SalesReturn[]>('/api/sales-returns');
    return data;
  },
};

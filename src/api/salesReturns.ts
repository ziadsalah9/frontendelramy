import api, { cleanRange, type DateRangeParams } from './client';
import type { PaymentMethod, RefundMethod, SalesInvoice, SalesReturn } from '@/types';

export const salesReturnsService = {
  /** ADMIN-only. */
  async create(invoiceId: number, input: { items: { invoiceItemId: number; quantity: number }[]; refundMethod: RefundMethod; reason?: string }): Promise<SalesReturn> {
    const { data } = await api.post<SalesReturn>(`/api/sales-invoices/${invoiceId}/returns`, input);
    return data;
  },
  /** Exchange (ADMIN): return items and take new ones in one step. */
  async exchange(invoiceId: number, input: {
    returnItems: { invoiceItemId: number; quantity: number }[];
    newItems: { variantId: number; quantity: number }[];
    paymentMethod: PaymentMethod;
    paid: number;
    cashAmount?: number;
    refundMethod: RefundMethod;
    reason?: string;
  }): Promise<{ returned: SalesReturn; newInvoice: SalesInvoice; returnValue: number; newTotal: number; paidNow: number; refundedCash: number; addedToBalance: number }> {
    const { data } = await api.post(`/api/sales-invoices/${invoiceId}/exchange`, input);
    return data;
  },
  async forInvoice(invoiceId: number): Promise<SalesReturn[]> {
    const { data } = await api.get<SalesReturn[]>(`/api/sales-invoices/${invoiceId}/returns`);
    return data;
  },
  async getAll(range: DateRangeParams = {}): Promise<SalesReturn[]> {
    const { data } = await api.get<SalesReturn[]>('/api/sales-returns', { params: cleanRange(range) });
    return data;
  },
};

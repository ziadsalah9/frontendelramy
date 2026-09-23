import api from './client';
import type { PurchaseInvoice, PurchaseInvoiceCreateInput } from '@/types';

export const purchaseInvoicesService = {
  async getAll(): Promise<PurchaseInvoice[]> {
    const { data } = await api.get<PurchaseInvoice[]>('/api/purchase-invoices');
    return data;
  },
  async getById(id: number): Promise<PurchaseInvoice> {
    const { data } = await api.get<PurchaseInvoice>(`/api/purchase-invoices/${id}`);
    return data;
  },
  async getByNumber(invoiceNumber: string): Promise<PurchaseInvoice> {
    const { data } = await api.get<PurchaseInvoice>(`/api/purchase-invoices/number/${invoiceNumber}`);
    return data;
  },
  async create(input: PurchaseInvoiceCreateInput): Promise<PurchaseInvoice> {
    const { data } = await api.post<PurchaseInvoice>('/api/purchase-invoices', input);
    return data;
  },
};

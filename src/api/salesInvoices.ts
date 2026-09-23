import api from './client';
import type { SalesInvoice, SalesInvoiceCreateInput } from '@/types';

export const salesInvoicesService = {
  async getAll(): Promise<SalesInvoice[]> {
    const { data } = await api.get<SalesInvoice[]>('/api/sales-invoices');
    return data;
  },
  async getById(id: number): Promise<SalesInvoice> {
    const { data } = await api.get<SalesInvoice>(`/api/sales-invoices/${id}`);
    return data;
  },
  async getByNumber(invoiceNumber: string): Promise<SalesInvoice> {
    const { data } = await api.get<SalesInvoice>(`/api/sales-invoices/number/${invoiceNumber}`);
    return data;
  },
  async create(input: SalesInvoiceCreateInput): Promise<SalesInvoice> {
    const { data } = await api.post<SalesInvoice>('/api/sales-invoices', input);
    return data;
  },
};

import api, { cleanRange, type DateRangeParams } from './client';
import type { SalesInvoice, SalesInvoiceCreateInput } from '@/types';

export const salesInvoicesService = {
  /** Newest first; an empty range means all history. */
  async getAll(range: DateRangeParams = {}): Promise<SalesInvoice[]> {
    const { data } = await api.get<SalesInvoice[]>('/api/sales-invoices', { params: cleanRange(range) });
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
  async getByCustomerPhone(phone: string): Promise<SalesInvoice[]> {
    const { data } = await api.get<SalesInvoice[]>(`/api/sales-invoices/customer/${encodeURIComponent(phone)}`);
    return data;
  },
  async create(input: SalesInvoiceCreateInput): Promise<SalesInvoice> {
    const { data } = await api.post<SalesInvoice>('/api/sales-invoices', input);
    return data;
  },
};

import api, { cleanRange, type DateRangeParams } from './client';
import type { PaymentMethod, Supplier, SupplierAccount, SupplierInput, SupplierPayment } from '@/types';

/** Suppliers and payments to them (ADMIN-only). */
export const suppliersService = {
  async getAll(): Promise<Supplier[]> {
    const { data } = await api.get<Supplier[]>('/api/suppliers');
    return data;
  },
  async create(input: SupplierInput): Promise<Supplier> {
    const { data } = await api.post<Supplier>('/api/suppliers', input);
    return data;
  },
  async update(id: number, input: SupplierInput): Promise<Supplier> {
    const { data } = await api.put<Supplier>(`/api/suppliers/${id}`, input);
    return data;
  },
  async toggle(id: number): Promise<Supplier> {
    const { data } = await api.patch<Supplier>(`/api/suppliers/${id}/toggle-status`);
    return data;
  },
  async getAccount(id: number): Promise<SupplierAccount> {
    const { data } = await api.get<SupplierAccount>(`/api/suppliers/${id}/account`);
    return data;
  },
  async pay(id: number, input: { branchId: number; amount: number; paymentMethod: PaymentMethod; notes?: string }): Promise<SupplierPayment> {
    const { data } = await api.post<SupplierPayment>(`/api/suppliers/${id}/payments`, input);
    return data;
  },
  async getAllPayments(range: DateRangeParams = {}): Promise<SupplierPayment[]> {
    const { data } = await api.get<SupplierPayment[]>('/api/supplier-payments', { params: cleanRange(range) });
    return data;
  },
};

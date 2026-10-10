import api from './client';
import type { DueInstallment, InstallmentCustomer, InstallmentPlan } from '@/types';

export const installmentsService = {
  /** The plan of an installment sale, or null for a normal sale. */
  async forInvoice(invoiceId: number): Promise<InstallmentPlan | null> {
    const res = await api.get<InstallmentPlan>(`/api/sales-invoices/${invoiceId}/installments`);
    return res.status === 204 ? null : res.data;
  },
  /** Every customer who bought on installments, the most late first. */
  async customers(): Promise<InstallmentCustomer[]> {
    const { data } = await api.get<InstallmentCustomer[]>('/api/installments/customers');
    return data;
  },
  /** One customer's plans with their schedules, newest first. */
  async forCustomer(customerId: number): Promise<InstallmentPlan[]> {
    const { data } = await api.get<InstallmentPlan[]>(`/api/installments/customers/${customerId}`);
    return data;
  },
  /** Unpaid installments due within `days` days from today (overdue included). */
  async due(days: number): Promise<DueInstallment[]> {
    const { data } = await api.get<DueInstallment[]>('/api/installments/due', { params: { days } });
    return data;
  },
};

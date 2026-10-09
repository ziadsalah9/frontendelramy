import api from './client';
import type { CustomerAccount, CustomerPayment, PaymentMethod } from '@/types';

export const customerAccountsService = {
  async getAccount(customerId: number): Promise<CustomerAccount> {
    const { data } = await api.get<CustomerAccount>(`/api/customers/${customerId}/account`);
    return data;
  },
  async pay(customerId: number, input: { branchId: number; amount: number; paymentMethod: PaymentMethod; notes?: string }): Promise<CustomerPayment> {
    const { data } = await api.post<CustomerPayment>(`/api/customers/${customerId}/payments`, input);
    return data;
  },
  async getAllPayments(): Promise<CustomerPayment[]> {
    const { data } = await api.get<CustomerPayment[]>('/api/customer-payments');
    return data;
  },
};

import api from './client';
import type { Customer, CustomerCreateInput } from '@/types';

export const customersService = {
  async getAll(): Promise<Customer[]> {
    const { data } = await api.get<Customer[]>('/api/customers');
    return data;
  },
  async getById(id: number): Promise<Customer> {
    const { data } = await api.get<Customer>(`/api/customers/${id}`);
    return data;
  },
  async getByPhone(phone: string): Promise<Customer> {
    const { data } = await api.get<Customer>(`/api/customers/phone/${phone}`);
    return data;
  },
  async create(input: CustomerCreateInput): Promise<Customer> {
    const { data } = await api.post<Customer>('/api/customers', input);
    return data;
  },
  async update(id: number, input: CustomerCreateInput): Promise<Customer> {
    const { data } = await api.put<Customer>(`/api/customers/${id}`, input);
    return data;
  },
};

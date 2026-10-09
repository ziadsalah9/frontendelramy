import api, { cleanRange, type DateRangeParams } from './client';
import type { Expense, ExpenseInput } from '@/types';

/** Shop expenses (ADMIN-only). */
export const expensesService = {
  async getAll(range: DateRangeParams = {}): Promise<Expense[]> {
    const { data } = await api.get<Expense[]>('/api/expenses', { params: cleanRange(range) });
    return data;
  },
  async create(input: ExpenseInput): Promise<Expense> {
    const { data } = await api.post<Expense>('/api/expenses', input);
    return data;
  },
  async update(id: number, input: ExpenseInput): Promise<Expense> {
    const { data } = await api.put<Expense>(`/api/expenses/${id}`, input);
    return data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/api/expenses/${id}`);
  },
};

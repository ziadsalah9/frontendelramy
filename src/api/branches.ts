import api from './client';
import type { Branch, BranchCreateInput } from '@/types';

export const branchesService = {
  async getAll(): Promise<Branch[]> {
    const { data } = await api.get<Branch[]>('/api/branches');
    return data;
  },
  async getById(id: number): Promise<Branch> {
    const { data } = await api.get<Branch>(`/api/branches/${id}`);
    return data;
  },
  async create(input: BranchCreateInput): Promise<Branch> {
    const { data } = await api.post<Branch>('/api/branches', input);
    return data;
  },
  async update(id: number, input: BranchCreateInput): Promise<Branch> {
    const { data } = await api.put<Branch>(`/api/branches/${id}`, input);
    return data;
  },
};

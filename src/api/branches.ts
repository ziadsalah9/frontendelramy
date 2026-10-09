import api from './client';
import type { Branch } from '@/types';

/** Read-only: single-branch mode (branches are not managed in the app). */
export const branchesService = {
  async getAll(): Promise<Branch[]> {
    const { data } = await api.get<Branch[]>('/api/branches');
    return data;
  },
  async getById(id: number): Promise<Branch> {
    const { data } = await api.get<Branch>(`/api/branches/${id}`);
    return data;
  },
};

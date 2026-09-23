import api from './client';
import type { User, UserCreateInput, UserUpdateInput } from '@/types';

export const usersService = {
  async getAll(): Promise<User[]> {
    const { data } = await api.get<User[]>('/api/users');
    return data;
  },
  async getById(id: number): Promise<User> {
    const { data } = await api.get<User>(`/api/users/${id}`);
    return data;
  },
  async create(input: UserCreateInput): Promise<User> {
    const { data } = await api.post<User>('/api/users', input);
    return data;
  },
  async update(id: number, input: UserUpdateInput): Promise<User> {
    const { data } = await api.put<User>(`/api/users/${id}`, input);
    return data;
  },
};

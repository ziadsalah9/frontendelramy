import api from './client';
import type { ItemType } from '@/types';

export const productTypesService = {
  /** Shown types, for product forms and filters. */
  async getActive(): Promise<ItemType[]> {
    const { data } = await api.get<ItemType[]>('/api/product-types');
    return data;
  },
  /** ADMIN: all types (hidden too) with usage counts. */
  async getAllForAdmin(): Promise<ItemType[]> {
    const { data } = await api.get<ItemType[]>('/api/product-types/manage');
    return data;
  },
  async create(name: string): Promise<ItemType> {
    const { data } = await api.post<ItemType>('/api/product-types', { name });
    return data;
  },
  async rename(id: number, name: string): Promise<ItemType> {
    const { data } = await api.put<ItemType>(`/api/product-types/${id}`, { name });
    return data;
  },
  async toggle(id: number): Promise<ItemType> {
    const { data } = await api.patch<ItemType>(`/api/product-types/${id}/toggle-status`);
    return data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/api/product-types/${id}`);
  },
};

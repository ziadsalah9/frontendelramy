import api from './client';
import type { ProductColor } from '@/types';

export const productColorsService = {
  /** Shown colours, for product forms. */
  async getActive(): Promise<ProductColor[]> {
    const { data } = await api.get<ProductColor[]>('/api/product-colors');
    return data;
  },
  /** ADMIN: all colours (hidden too) with usage counts. */
  async getAllForAdmin(): Promise<ProductColor[]> {
    const { data } = await api.get<ProductColor[]>('/api/product-colors/manage');
    return data;
  },
  async create(name: string, hex: string | null): Promise<ProductColor> {
    const { data } = await api.post<ProductColor>('/api/product-colors', { name, hex });
    return data;
  },
  async update(id: number, name: string, hex: string | null): Promise<ProductColor> {
    const { data } = await api.put<ProductColor>(`/api/product-colors/${id}`, { name, hex });
    return data;
  },
  async toggle(id: number): Promise<ProductColor> {
    const { data } = await api.patch<ProductColor>(`/api/product-colors/${id}/toggle-status`);
    return data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/api/product-colors/${id}`);
  },
};

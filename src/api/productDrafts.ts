import api from './client';
import type { Product, ProductDraft, ProductDraftInput } from '@/types';

// Incomplete products from Excel imports ("منتجات غير مكتملة"). ADMIN only.
export const productDraftsService = {
  async getAll(): Promise<ProductDraft[]> {
    const { data } = await api.get<ProductDraft[]>('/api/product-drafts');
    return data;
  },
  async count(): Promise<number> {
    const { data } = await api.get<{ count: number }>('/api/product-drafts/count');
    return data.count;
  },
  async update(id: number, input: ProductDraftInput): Promise<ProductDraft> {
    const { data } = await api.put<ProductDraft>(`/api/product-drafts/${id}`, input);
    return data;
  },
  /** Moves the draft into the system as a real product. */
  async complete(id: number): Promise<Product> {
    const { data } = await api.post<Product>(`/api/product-drafts/${id}/complete`);
    return data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/api/product-drafts/${id}`);
  },
};

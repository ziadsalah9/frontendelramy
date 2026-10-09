import api from './client';
import type {
  ProductType,
  StocktakeCountLine,
  StocktakeCountView,
  StocktakeImportResult,
  StocktakeReason,
  StocktakeReview,
  StocktakeReviewLine,
  StocktakeSummary,
} from '@/types';

/** Stocktaking (الجرد); every endpoint is ADMIN-only. */
export const stocktakesService = {
  async getAll(): Promise<StocktakeSummary[]> {
    const { data } = await api.get<StocktakeSummary[]>('/api/stocktakes');
    return data;
  },
  async create(input: { title: string; types: ProductType[]; notes?: string }): Promise<StocktakeSummary> {
    const { data } = await api.post<StocktakeSummary>('/api/stocktakes', input);
    return data;
  },
  async getForCounting(id: number): Promise<StocktakeCountView> {
    const { data } = await api.get<StocktakeCountView>(`/api/stocktakes/${id}`);
    return data;
  },
  async getReview(id: number): Promise<StocktakeReview> {
    const { data } = await api.get<StocktakeReview>(`/api/stocktakes/${id}/review`);
    return data;
  },
  async setCount(id: number, variantId: number, quantity: number): Promise<StocktakeCountLine> {
    const { data } = await api.put<StocktakeCountLine>(`/api/stocktakes/${id}/lines/${variantId}`, { quantity });
    return data;
  },
  async scan(id: number, code: string): Promise<{ line: StocktakeCountLine; created: boolean }> {
    const { data } = await api.post<{ line: StocktakeCountLine; created: boolean }>(`/api/stocktakes/${id}/scan`, { code });
    return data;
  },
  async removeLine(id: number, variantId: number): Promise<void> {
    await api.delete(`/api/stocktakes/${id}/lines/${variantId}`);
  },
  async setReason(id: number, variantId: number, reason: StocktakeReason | null, note: string): Promise<StocktakeReviewLine> {
    const { data } = await api.patch<StocktakeReviewLine>(`/api/stocktakes/${id}/lines/${variantId}/reason`, { reason, note });
    return data;
  },
  async downloadSheet(id: number): Promise<Blob> {
    const { data } = await api.get<Blob>(`/api/stocktakes/${id}/sheet`, { responseType: 'blob' });
    return data;
  },
  async importCounts(id: number, file: File): Promise<StocktakeImportResult> {
    const body = new FormData();
    body.append('file', file);
    const { data } = await api.post<StocktakeImportResult>(`/api/stocktakes/${id}/import`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  async approve(id: number): Promise<StocktakeReview> {
    const { data } = await api.post<StocktakeReview>(`/api/stocktakes/${id}/approve`);
    return data;
  },
  async cancel(id: number): Promise<StocktakeSummary> {
    const { data } = await api.post<StocktakeSummary>(`/api/stocktakes/${id}/cancel`);
    return data;
  },
};

import api from './client';
import type { Product, ProductCreateInput, VariantLookup, ProductPrice, ProductPriceUpdateInput, ProductImportResult } from '@/types';

export const productsService = {
  async getAll(): Promise<Product[]> {
    const { data } = await api.get<Product[]>('/api/products');
    return data;
  },
  async getById(id: number): Promise<Product> {
    const { data } = await api.get<Product>(`/api/products/${id}`);
    return data;
  },
  async create(input: ProductCreateInput): Promise<Product> {
    const { data } = await api.post<Product>('/api/products', input);
    return data;
  },
  async update(id: number, input: ProductCreateInput): Promise<Product> {
    const { data } = await api.put<Product>(`/api/products/${id}`, input);
    return data;
  },
  /** Finds a colour/size by its code or barcode (scanner input). */
  async lookupVariant(code: string): Promise<VariantLookup> {
    const { data } = await api.get<VariantLookup>('/api/products/variants/lookup', { params: { code } });
    return data;
  },
  async delete(id: number): Promise<void> {
    await api.delete(`/api/products/${id}`);
  },
  async toggleStatus(id: number): Promise<void> {
    await api.patch(`/api/products/${id}/toggle-status`);
  },
  /** Active products at or below their minimum quantity. */
  async getLowStock(): Promise<Product[]> {
    const { data } = await api.get<Product[]>('/api/products/low-stock');
    return data;
  },
  /** Blank Excel template for bulk import (ADMIN). */
  async downloadImportTemplate(): Promise<Blob> {
    const { data } = await api.get<Blob>('/api/products/import/template', { responseType: 'blob' });
    return data;
  },
  /**
   * Uploads a filled template. All-or-nothing on the backend: a 400 carries
   * `errors` (one per bad cell/row) and nothing is saved.
   */
  async importFromExcel(file: File, onProgress?: (percent: number) => void): Promise<ProductImportResult> {
    const body = new FormData();
    body.append('file', file);
    const { data } = await api.post<ProductImportResult>('/api/products/import', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Validating + creating up to 1000 products can take a while.
      timeout: 120_000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data;
  },
};

export const productPricesService = {
  // Returns 404 when the product has no price yet.
  async getPrice(productId: number): Promise<ProductPrice> {
    const { data } = await api.get<ProductPrice>(`/api/products/${productId}/price`);
    return data;
  },
  // Sets the current price: the same call for the first price and for
  // later changes. Responds with the updated Product (carrying currentPrice).
  async setPrice(productId: number, input: ProductPriceUpdateInput): Promise<Product> {
    const { data } = await api.post<Product>(`/api/products/${productId}/price`, input);
    return data;
  },
};

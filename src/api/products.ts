import api from './client';
import type { Product, ProductCreateInput, ProductPrice, ProductPriceUpdateInput } from '@/types';

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
  async delete(id: number): Promise<void> {
    await api.delete(`/api/products/${id}`);
  },
};

export const productPricesService = {
  async getPrice(productId: number): Promise<ProductPrice> {
    const { data } = await api.get<ProductPrice>(`/api/products/${productId}/price`);
    return data;
  },
  async updatePrice(productId: number, input: ProductPriceUpdateInput): Promise<ProductPrice> {
    const { data } = await api.put<ProductPrice>(`/api/products/${productId}/price`, input);
    return data;
  },
};

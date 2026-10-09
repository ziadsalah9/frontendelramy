import api from './client';
import type { StoreSettings } from '@/types';

export const settingsService = {
  async get(): Promise<StoreSettings> {
    const { data } = await api.get<StoreSettings>('/api/settings');
    return data;
  },
  /** ADMIN-only. */
  async update(input: StoreSettings): Promise<StoreSettings> {
    const { data } = await api.put<StoreSettings>('/api/settings', input);
    return data;
  },
};

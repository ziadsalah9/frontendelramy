import api from './client';
import type { ActivityLogFilters, ActivityLogPage } from '@/types';

export const activityLogsService = {
  /** Newest first, filtered and paged on the server. ADMIN-only. */
  async search(filters: ActivityLogFilters): Promise<ActivityLogPage> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
    const { data } = await api.get<ActivityLogPage>('/api/activity-logs', { params });
    return data;
  },
};

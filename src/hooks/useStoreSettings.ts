import { useQuery } from '@tanstack/react-query';
import { settingsService } from '@/api/settings';

/** Store name/phone/address for receipts and the employee discount limit. */
export function useStoreSettings() {
  return useQuery({ queryKey: ['store-settings'], queryFn: settingsService.get, staleTime: 5 * 60 * 1000 });
}

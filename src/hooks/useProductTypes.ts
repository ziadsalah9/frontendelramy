import { useQuery } from '@tanstack/react-query';
import { productTypesService } from '@/api/productTypes';

/**
 * Dropdown options for product types. `current` (a product's own type) is
 * added when it is hidden, so editing that product does not lose its type.
 */
export function useProductTypeOptions(current?: string | null) {
  const { data, isLoading } = useQuery({ queryKey: ['product-types'], queryFn: productTypesService.getActive, staleTime: 60_000 });
  const options = (data ?? []).map((t) => ({ value: t.name, label: t.name }));
  if (current && !options.some((o) => o.value === current)) options.push({ value: current, label: `${current} (مخفي)` });
  return { options, isLoading };
}

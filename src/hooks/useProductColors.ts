import { useQuery } from '@tanstack/react-query';
import { productColorsService } from '@/api/productColors';

export interface ColorOption {
  value: string;
  label: string;
  hex: string | null;
}

/** The shown colours (managed in Settings), cached for the session. */
export function useProductColors() {
  const { data, isLoading } = useQuery({ queryKey: ['product-colors'], queryFn: productColorsService.getActive, staleTime: 60_000 });
  const options: ColorOption[] = (data ?? []).map((c) => ({ value: c.name, label: c.name, hex: c.hex }));
  const hexOf = (name: string | null | undefined) => options.find((o) => o.value === name)?.hex ?? null;
  return { options, hexOf, isLoading };
}

/** Options plus `current` when it is hidden, so editing an item does not lose its colour. */
export function withCurrentColor(options: ColorOption[], current: string | null | undefined): ColorOption[] {
  return current && !options.some((o) => o.value === current) ? [...options, { value: current, label: `${current} (مخفي)`, hex: null }] : options;
}

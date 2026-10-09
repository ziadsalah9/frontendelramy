import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { productsService } from '@/api/products';
import type { Product } from '@/types';

/** How often to re-check stock while the app is open. */
const REFETCH_INTERVAL_MS = 60_000;

/**
 * Watches `/api/products/low-stock` and raises a warning toast the first
 * time a product drops to (or below) its minimum quantity.
 *
 * Two details keep this from becoming noise:
 *
 * - A row is announced once, not on every poll. `announced` holds the ids
 *   already shown, and an id is forgotten as soon as the row recovers, so
 *   a later drop warns again.
 * - Several rows crossing the limit in the same poll produce one toast
 *   rather than one per row.
 *
 * `onOpen` is invoked from the toast action so the user can jump straight
 * to the list. It is held in a ref so that a new inline callback on every
 * render cannot re-trigger the effect.
 */
export function useLowStockAlerts(onOpen?: () => void) {
  const announced = useRef<Set<number>>(new Set());
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });

  const { data, isLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: productsService.getLowStock,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const lowStock: Product[] = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (!data) return;

    const currentIds = new Set(lowStock.map((s) => s.id));

    // Forget rows that recovered so a future drop is announced again.
    announced.current.forEach((id) => {
      if (!currentIds.has(id)) announced.current.delete(id);
    });

    const fresh = lowStock.filter((s) => !announced.current.has(s.id));
    if (fresh.length === 0) return;

    fresh.forEach((s) => announced.current.add(s.id));

    const single = fresh.length === 1;
    const names = fresh.map((s) => s.name);

    toast.warning(
      single
        ? `المنتج "${names[0]}" وصل إلى الحد الأدنى للمخزون`
        : `${fresh.length} منتجات وصلت إلى الحد الأدنى للمخزون`,
      {
        description: single
          ? `الكمية المتاحة ${fresh[0].quantity} والحد الأدنى ${fresh[0].minimumQuantity ?? 0}`
          : names.join('، '),
        duration: 8000,
        action: onOpenRef.current
          ? { label: 'عرض', onClick: () => onOpenRef.current?.() }
          : undefined,
      },
    );
  }, [data, lowStock]);

  return { lowStock, count: lowStock.length, isLoading };
}
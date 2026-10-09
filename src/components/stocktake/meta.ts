import type { Product, ProductType, StocktakeStatus } from '@/types';

export const STOCKTAKE_STATUS: Record<StocktakeStatus, { label: string; variant: 'info' | 'success' | 'default' }> = {
  OPEN: { label: 'مفتوح', variant: 'info' },
  APPROVED: { label: 'معتمد', variant: 'success' },
  CANCELLED: { label: 'ملغي', variant: 'default' },
};

export const scopeText = (types: ProductType[]) => (types.length === 0 ? 'كل المنتجات' : types.join('، '));

/** Active colours/sizes of active products in scope (same rule as the backend). */
export function countableVariants(products: Product[], types: ProductType[]) {
  return products
    .filter((p) => p.active !== false && (types.length === 0 || types.includes(p.itemType)))
    .flatMap((p) => p.variants.filter((v) => v.active !== false).map((v) => ({ product: p, variant: v })))
    .sort((a, b) => a.product.name.localeCompare(b.product.name, 'ar') || a.variant.id - b.variant.id);
}

/** Saves a downloaded blob under the given file name. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

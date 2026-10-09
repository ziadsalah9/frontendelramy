// Price recalculation shared by the product form and the incomplete
// products editor, so both behave the same.

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type PriceAnchor = 'profit' | 'selling';

export interface PriceFields {
  basePrice: string;
  profitPercent: string;
  sellingPrice: string;
}

/**
 * Re-derives the dependent price field after any of the three changes.
 * The anchor is whichever of profit % / selling price the user typed last;
 * the other one is always computed from cost + anchor, so the three values
 * can never disagree. A missing cost or anchor clears the derived field
 * instead of leaving a stale number behind.
 */
export function reprice<T extends PriceFields>(f: T, anchor: PriceAnchor): T {
  const bp = Number(f.basePrice);
  const hasBase = f.basePrice !== '' && bp > 0;
  if (anchor === 'profit') {
    const sellingPrice = hasBase && f.profitPercent !== ''
      ? round2(bp * (1 + Number(f.profitPercent) / 100)).toString()
      : '';
    return { ...f, sellingPrice };
  }
  const profitPercent = hasBase && f.sellingPrice !== ''
    ? round2(((Number(f.sellingPrice) - bp) / bp) * 100).toString()
    : '';
  return { ...f, profitPercent };
}

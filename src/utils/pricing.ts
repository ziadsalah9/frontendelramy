// Price recalculation shared by the product form and the incomplete
// products editor, so both behave the same.

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `percent`% of `amount`, to the piastre, rounded half up - exactly like
 * the server (SalesInvoiceServiceImpl.percentOf). Done in whole piastres
 * and hundredths of a percent, so floating point cannot shift the result
 * (7.3% of 123.45 is 9.01 here and there).
 */
export const percentOf = (amount: number, percent: number) => {
  const piastres = Math.round(amount * 100);
  const hundredths = Math.round(percent * 100);
  if (piastres <= 0 || hundredths <= 0) return 0;
  return Math.floor((piastres * hundredths + 5000) / 10000) / 100;
};

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

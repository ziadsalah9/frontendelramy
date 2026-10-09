// Helpers for the product form's colour/size rows (see VariantsEditor).

/** One colour/size row in the product form. */
export interface VariantRow {
  /** Stable React key (existing id or a temp value). */
  key: string;
  id?: number;
  color: string;
  size: string;
  /** Read-only info for existing variants. */
  code?: string;
  /** Stock currently saved (existing variants). */
  quantity?: number;
  /**
   * Quantity typed in the form. For a new colour/size it is the opening
   * stock; for an existing one a change is saved as a stock adjustment.
   */
  qty: string;
}

let tempKey = 0;
export const newVariantRow = (color = '', size = ''): VariantRow => ({ key: `new-${++tempKey}`, color, size, qty: '' });

/** Same rule as the backend (ProductFieldRules.comboKey): trimmed, single spaces. */
const norm = (v?: string | null) => (v ?? '').trim().replace(/\s+/g, ' ');
export const comboKey = (r: { color?: string | null; size?: string | null }) => `${norm(r.color)}|${norm(r.size)}`;

/** Returns an Arabic error when two rows have the same colour and size. */
export function duplicateVariantError(rows: VariantRow[]): string | null {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = comboKey(r);
    if (seen.has(k)) {
      const label = [r.color, r.size].filter(Boolean).join(' / ') || 'بدون لون أو مقاس';
      return `اللون/المقاس مكرر: ${label}`;
    }
    seen.add(k);
  }
  return null;
}

/**
 * Pieces assigned to colours/sizes. An empty quantity counts as the row's
 * saved stock for an existing product variant, and as 0 otherwise.
 */
export function distributedQuantity(rows: VariantRow[], draft = false): number {
  return rows.reduce((sum, r) => {
    if (r.qty.trim() !== '') return sum + (Number(r.qty) || 0);
    return sum + (!draft && r.id != null ? r.quantity ?? 0 : 0);
  }, 0);
}

/** Arabic error when the colours/sizes add up to more than the total. */
export function overTotalError(rows: VariantRow[], total: string, draft = false): string | null {
  if (total.trim() === '') return null;
  const sum = distributedQuantity(rows, draft);
  return sum > Number(total) ? `مجموع كميات الألوان/المقاسات (${sum}) أكبر من إجمالي الكمية (${total})` : null;
}

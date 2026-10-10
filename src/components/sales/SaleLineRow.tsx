import { useState } from 'react';
import { Minus, Plus, Tag, X } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

/**
 * One line of the sale, as a cashier reads it: what it is, how many (a
 * stepper with big buttons, also typeable), what it costs. The discount
 * stays collapsed until it is wanted or already used.
 */
export function SaleLineRow({
  name, detail, unitPrice, available, quantity, discount, discountPercent, lineTotal, error,
  onQuantity, onStep, onDiscountPercent, onDiscountAmount, onRemove,
}: {
  name: string;
  /** Colour / size and code. */
  detail: string;
  unitPrice: number;
  available: number;
  quantity: string;
  discount: string;
  discountPercent: string;
  lineTotal: number;
  error?: string;
  onQuantity: (raw: string) => void;
  /** After a + / - press (the pressed button may disable itself and drop the focus). */
  onStep?: () => void;
  onDiscountPercent: (raw: string) => void;
  onDiscountAmount: (raw: string) => void;
  onRemove?: () => void;
}) {
  const qty = Number(quantity) || 0;
  const discountValue = Number(discount) || 0;
  const [discountOpen, setDiscountOpen] = useState(discountValue > 0);
  const step = 'h-10 w-10 flex items-center justify-center rounded-lg border bg-background hover:bg-accent disabled:opacity-40 disabled:hover:bg-background transition-colors';
  const box = 'h-9 rounded-lg border border-input bg-background px-2 text-sm text-center';

  return (
    <div className={`p-3 rounded-lg border ${error ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground">
            {detail} · سعر {formatCurrency(unitPrice)} · متاح {available}
          </p>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`حذف ${name}`} className="p-2 -m-1 rounded-lg text-destructive hover:bg-destructive/10">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" dir="ltr">
          <button type="button" className={step} onClick={() => { onQuantity(String(Math.max(1, qty - 1))); onStep?.(); }} disabled={qty <= 1} aria-label="تقليل الكمية">
            <Minus className="w-4 h-4" />
          </button>
          <input type="text" inputMode="numeric" value={quantity} onChange={(e) => onQuantity(e.target.value)} aria-label={`كمية ${name}`}
            className="h-10 w-14 rounded-lg border border-input bg-background text-center text-sm font-semibold" />
          <button type="button" className={step} onClick={() => { onQuantity(String(qty + 1)); onStep?.(); }} disabled={qty >= available} aria-label="زيادة الكمية">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {!discountOpen && (
            <button type="button" onClick={() => setDiscountOpen(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Tag className="w-3.5 h-3.5" /> خصم
            </button>
          )}
          <div className="text-left">
            {discountValue > 0 && <p className="text-[11px] text-success">خصم − {formatCurrency(discountValue)}</p>}
            <p className="text-base font-bold text-foreground" dir="ltr">{formatCurrency(lineTotal)} <span className="text-xs font-medium">ج.م</span></p>
          </div>
        </div>
      </div>

      {discountOpen && (
        <div className="mt-2 pt-2 border-t flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>خصم البند</span>
          <div className="relative" dir="ltr">
            <input type="text" inputMode="decimal" value={discountPercent} onChange={(e) => onDiscountPercent(e.target.value)} aria-label={`نسبة خصم ${name}`} className={`${box} w-20 pr-6`} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">%</span>
          </div>
          <div className="relative" dir="ltr">
            <input type="text" inputMode="decimal" value={discount} onChange={(e) => onDiscountAmount(e.target.value)} aria-label={`قيمة خصم ${name}`} className={`${box} w-24 pr-9`} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">ج.م</span>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

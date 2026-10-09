import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import type { Product, ProductVariant } from '@/types';
import { matches } from '@/utils/validation';

export interface VariantOption {
  product: Product;
  variant: ProductVariant;
}

const MAX_SHOWN = 100;

/**
 * Product picker for the stocktake: opens a dropdown of every colour/size
 * in scope on focus, filters as you type (name, code, barcode, colour/size)
 * and supports arrows / Enter / Escape. Counted items show their count.
 */
export function VariantCombobox({
  options,
  counted,
  onPick,
  disabled,
}: {
  options: VariantOption[];
  /** variantId -> counted quantity, for the ✓ badge. */
  counted: Map<number, number>;
  onPick: (option: VariantOption) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter(({ product, variant }) =>
      matches(product.name, q) || matches(variant.code, q) || matches(variant.barcode, q) || matches(variant.label, q));
  }, [options, query]);
  const shown = filtered.slice(0, MAX_SHOWN);

  useEffect(() => setActive(0), [query]);

  // Close when clicking outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Keep the highlighted option visible while using the arrow keys.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (o: VariantOption) => {
    onPick(o);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          role="combobox"
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'جاري تحميل المنتجات...' : 'اختر المنتج أو اكتب للبحث...'}
          aria-label="اختيار المنتج"
          aria-expanded={open}
          aria-controls="stk-variant-list"
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full h-10 pr-10 pl-9 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:bg-accent"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && !disabled && (
        <div ref={listRef} id="stk-variant-list" role="listbox" className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border bg-card shadow-lg">
          {shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {options.length === 0 ? 'لا توجد منتجات في نطاق هذا الجرد' : `لا يوجد منتج مطابق لـ "${query.trim()}"`}
            </p>
          ) : (
            <>
              {shown.map((o, i) => {
                const c = counted.get(o.variant.id);
                return (
                  <button
                    key={o.variant.id}
                    type="button"
                    role="option"
                    data-index={i}
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-right text-sm border-b last:border-0 transition-colors ${i === active ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{o.product.name}</span>
                      <span className="text-muted-foreground"> ({o.variant.label})</span>
                      <span className="block text-xs text-muted-foreground font-mono" dir="ltr">{o.variant.code}</span>
                    </span>
                    {c != null && (
                      <span className="flex items-center gap-1 text-xs text-success shrink-0"><Check className="w-3.5 h-3.5" /> {c}</span>
                    )}
                  </button>
                );
              })}
              {filtered.length > MAX_SHOWN && (
                <p className="p-2 text-center text-xs text-muted-foreground">يظهر أول {MAX_SHOWN} من {filtered.length}. اكتب للتصفية.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

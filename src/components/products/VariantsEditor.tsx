import { useState } from 'react';
import { Plus, X, Layers, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useProductColors, withCurrentColor } from '@/hooks/useProductColors';
import { ColorSwatch } from '@/components/shared/ColorSwatch';
import { newVariantRow, comboKey, distributedQuantity, type VariantRow } from '@/utils/variants';
import { sanitizeInt } from '@/utils/validation';

/** Matches product_variants.size (VARCHAR(50)) and the backend check. */
const MAX_SIZE = 50;

/** "كبير، 200x230, طقم 4" -> ["كبير", "200x230", "طقم 4"] (Arabic or Latin commas). */
const splitSizes = (text: string) =>
  [...new Set(text.split(/[,،]/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean))].map((s) => s.slice(0, MAX_SIZE));

const fieldCls = 'w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none';

/**
 * Total available quantity + its split over colours and sizes, shared by
 * the product form and incomplete products. The colours/sizes may add up
 * to at most the total; what is left is saved as "بدون لون أو مقاس".
 *
 * {@code draft}: quantities are what will be added on completion, not live
 * stock, so nothing is locked and an empty quantity counts as 0.
 */
export function VariantsEditor({
  rows,
  onChange,
  total,
  onTotalChange,
  totalError,
  error,
  draft = false,
}: {
  rows: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
  total: string;
  onTotalChange: (total: string) => void;
  totalError?: string;
  error?: string;
  draft?: boolean;
}) {
  const { options: colors, hexOf } = useProductColors();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkColors, setBulkColors] = useState<string[]>([]);
  const [bulkSizesText, setBulkSizesText] = useState('');
  const bulkSizes = splitSizes(bulkSizesText);

  const update = (key: string, field: 'color' | 'size' | 'qty', value: string) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const remove = (key: string) => onChange(rows.filter((r) => r.key !== key));
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const addCombinations = () => {
    const colors = bulkColors.length ? bulkColors : [''];
    const sizes = bulkSizes.length ? bulkSizes : [''];
    const existing = new Set(rows.map(comboKey));
    // Replace a single empty starter row instead of keeping it next to the new ones.
    const base = rows.length === 1 && !rows[0].id && !rows[0].color && !rows[0].size && !rows[0].qty ? [] : rows;
    const added: VariantRow[] = [];
    for (const c of colors) {
      for (const s of sizes) {
        const k = comboKey({ color: c, size: s });
        if (!existing.has(k)) {
          existing.add(k);
          added.push(newVariantRow(c, s));
        }
      }
    }
    onChange([...base, ...added]);
    setBulkColors([]);
    setBulkSizesText('');
    setBulkOpen(false);
  };

  // ---- total vs distributed
  const totalNum = total.trim() === '' ? null : Number(total);
  const distributed = distributedQuantity(rows, draft);
  const rest = totalNum == null ? 0 : totalNum - distributed;
  const over = totalNum != null && rest < 0;
  const pct = totalNum && totalNum > 0 ? Math.min(100, Math.round((distributed / totalNum) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Total + distribution status */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr] items-start">
        <div className="space-y-1.5">
          <label htmlFor="total-qty" className="block text-sm font-medium text-foreground">
            إجمالي الكمية المتاحة <span className="text-destructive">*</span>
          </label>
          <input
            id="total-qty"
            type="text"
            inputMode="numeric"
            value={total}
            onChange={(e) => onTotalChange(sanitizeInt(e.target.value).slice(0, 7))}
            placeholder="مثال: 10"
            dir="ltr"
            aria-invalid={totalError ? true : undefined}
            className={`${fieldCls} text-base font-semibold ${totalError ? 'border-destructive' : ''}`}
          />
          {totalError && <p className="text-xs text-destructive">{totalError}</p>}
        </div>

        <div className="p-3 rounded-lg bg-muted/40 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span>موزعة على الألوان/المقاسات</span>
            <span className={`font-semibold ${over ? 'text-destructive' : ''}`} dir="ltr">{distributed} / {totalNum ?? '—'}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full transition-all ${over ? 'bg-destructive' : rest === 0 && totalNum != null ? 'bg-success' : 'bg-primary'}`} style={{ width: `${over ? 100 : pct}%` }} />
          </div>
          {totalNum == null ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="w-3.5 h-3.5 shrink-0" /> اكتب إجمالي الكمية ثم وزّعها على الألوان والمقاسات.</p>
          ) : over ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> تجاوزت الإجمالي بـ {-rest}. قلل الكميات أو زد الإجمالي.</p>
          ) : rest > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-warning"><Info className="w-3.5 h-3.5 shrink-0" /> المتبقي {rest} سيُحفظ كـ «بدون لون أو مقاس».</p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> تم توزيع الكمية بالكامل.</p>
          )}
        </div>
      </div>

      {/* Colour / size / quantity rows */}
      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-[1fr_1fr_110px_40px] gap-2 px-1 text-xs font-medium text-muted-foreground">
          <span>اللون</span>
          <span>المقاس</span>
          <span>الكمية</span>
          <span />
        </div>
        {rows.map((r) => {
          const hasStock = !draft && (r.quantity ?? 0) > 0;
          const changed = !draft && r.id != null && r.qty !== '' && Number(r.qty) !== (r.quantity ?? 0);
          return (
            <div key={r.key} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_110px_40px] gap-2 items-start p-2 rounded-lg border bg-background">
              <div className="relative">
                {r.color && <ColorSwatch name={r.color} hex={hexOf(r.color)} className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" />}
                <select value={r.color} onChange={(e) => update(r.key, 'color', e.target.value)} aria-label="اللون" className={`${fieldCls} ${r.color ? 'pr-8' : ''}`}>
                  <option value="">بدون لون</option>
                  {withCurrentColor(colors, r.color).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <input
                type="text"
                value={r.size}
                onChange={(e) => update(r.key, 'size', e.target.value)}
                maxLength={MAX_SIZE}
                placeholder="بدون مقاس"
                aria-label="المقاس"
                className={fieldCls}
              />
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={r.qty}
                  onChange={(e) => update(r.key, 'qty', sanitizeInt(e.target.value).slice(0, 7))}
                  placeholder="0"
                  aria-label="الكمية"
                  className={`${fieldCls} text-left`}
                  dir="ltr"
                />
                {changed && <span className="block mt-0.5 text-[11px] text-warning">كان {r.quantity ?? 0}</span>}
              </div>
              <button
                type="button"
                onClick={() => remove(r.key)}
                disabled={rows.length === 1 || hasStock}
                title={hasStock ? 'لا يمكن حذف لون/مقاس به مخزون' : rows.length === 1 ? 'المنتج يحتاج لون/مقاس واحد على الأقل' : 'حذف'}
                aria-label="حذف اللون/المقاس"
                className="h-10 w-10 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:hover:bg-transparent justify-self-end"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([...rows, newVariantRow()])} className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-dashed border-primary/50 text-primary text-sm hover:bg-primary/5">
          <Plus className="w-4 h-4" /> إضافة لون/مقاس
        </button>
        <button type="button" onClick={() => setBulkOpen((v) => !v)} aria-expanded={bulkOpen} className="flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm hover:bg-accent">
          <Layers className="w-4 h-4" /> عدة ألوان × مقاسات
        </button>
      </div>

      {bulkOpen && (
        <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
          <div>
            <p className="text-xs font-medium mb-1.5">الألوان</p>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => (
                <button key={c.value} type="button" aria-pressed={bulkColors.includes(c.value)} onClick={() => setBulkColors(toggle(bulkColors, c.value))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${bulkColors.includes(c.value) ? 'bg-primary text-white border-primary' : 'bg-background border-input hover:bg-accent'}`}>
                  <ColorSwatch name={c.value} hex={c.hex} className="w-3 h-3" />
                  {c.label}
                </button>
              ))}
              {colors.length === 0 && <span className="text-xs text-muted-foreground">لا توجد ألوان. أضفها من الإعدادات.</span>}
            </div>
          </div>
          <div>
            <label htmlFor="bulk-sizes" className="block text-xs font-medium mb-1.5">المقاسات</label>
            <input
              id="bulk-sizes"
              type="text"
              value={bulkSizesText}
              onChange={(e) => setBulkSizesText(e.target.value)}
              placeholder="اكتب المقاسات مفصولة بفاصلة، مثال: صغير، كبير، 200x230"
              className={fieldCls}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{Math.max(bulkColors.length, 1) * Math.max(bulkSizes.length, 1)} تركيبة</span>
            <button type="button" onClick={addCombinations} disabled={!bulkColors.length && !bulkSizes.length}
              className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50">إضافة كل التركيبات</button>
          </div>
        </div>
      )}
    </div>
  );
}

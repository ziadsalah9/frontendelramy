import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Barcode, Download, Upload, Printer, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { stocktakesService } from '@/api/stocktakes';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { StocktakeCountLine, StocktakeImportResult, StocktakeSummary } from '@/types';
import { Modal } from '@/components/shared/Modal';
import { formatDate } from '@/utils/format';
import { sanitizeInt } from '@/utils/validation';
import { countableVariants, saveBlob, scopeText } from './meta';
import { VariantCombobox, type VariantOption } from './VariantCombobox';

const MAX_COUNT = 99999;

/**
 * Blind counting: only what was counted is listed, never the system
 * quantity. Scan adds 1; picking from the product dropdown sets a quantity.
 */
export function CountTab({
  stocktake,
  lines,
  onChanged,
}: {
  stocktake: StocktakeSummary;
  lines: StocktakeCountLine[];
  onChanged: () => void;
}) {
  const open = stocktake.status === 'OPEN';
  const products = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });
  const scope = useMemo(() => countableVariants(products.data ?? [], stocktake.types), [products.data, stocktake.types]);

  // ---- scanner
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const scan = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c || scanning) return;
    setScanning(true);
    try {
      const { line } = await stocktakesService.scan(stocktake.id, c);
      toast.success(`${line.productName} (${line.label}): ${line.countedQty}`);
      setCode('');
      onChanged();
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setScanning(false);
      scanRef.current?.focus();
    }
  };

  // ---- pick from the dropdown + type the quantity
  const [picked, setPicked] = useState<VariantOption | null>(null);
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const countedQty = useMemo(() => new Map(lines.map((l) => [l.variantId, l.countedQty])), [lines]);

  const pick = (o: VariantOption) => {
    setPicked(o);
    setQty(countedQty.has(o.variant.id) ? String(countedQty.get(o.variant.id)) : '');
  };

  const saveCount = async (variantId: number, value: string) => {
    if (saving) return;
    const n = Number(value);
    if (value === '' || !Number.isInteger(n) || n < 0 || n > MAX_COUNT) {
      toast.error(`اكتب عدداً صحيحاً من 0 إلى ${MAX_COUNT}`);
      return;
    }
    setSaving(true);
    try {
      await stocktakesService.setCount(stocktake.id, variantId, n);
      onChanged();
      setPicked(null);
      setQty('');
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (variantId: number) => {
    try {
      await stocktakesService.removeLine(stocktake.id, variantId);
      onChanged();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  // ---- Excel
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'download' | 'upload' | null>(null);
  const [importResult, setImportResult] = useState<StocktakeImportResult | null>(null);
  const download = async () => {
    if (busy) return;
    setBusy('download');
    try {
      saveBlob(await stocktakesService.downloadSheet(stocktake.id), `جرد-${stocktake.code}.xlsx`);
    } catch (err) {
      toast.error(`تعذر تنزيل ملف الجرد: ${extractApiError(err).message}`);
    } finally {
      setBusy(null);
    }
  };
  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy('upload');
    try {
      const r = await stocktakesService.importCounts(stocktake.id, file);
      setImportResult(r);
      onChanged();
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const progress = stocktake.totalInScope > 0 ? Math.round((stocktake.countedLines / stocktake.totalInScope) * 100) : 0;
  const btn = 'flex items-center gap-2 h-10 px-3 rounded-lg border text-sm hover:bg-accent disabled:opacity-50';

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between text-sm mb-2">
          <span>تم عد <strong>{stocktake.countedLines}</strong> من <strong>{stocktake.totalInScope}</strong> لون/مقاس</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {open && (
        <>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0" />
            سجّل العدد فور عدّ الرف: الفرق يُحسب على مخزون النظام لحظة التسجيل، والبيع مستمر أثناء الجرد.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <form onSubmit={scan} className="p-4 rounded-xl border bg-card space-y-2">
              <label htmlFor="stk-scan" className="flex items-center gap-2 text-sm font-medium"><Barcode className="w-4 h-4" /> مسح الباركود</label>
              <div className="flex gap-2">
                <input
                  id="stk-scan"
                  ref={scanRef}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="امسح أو اكتب الكود ثم Enter"
                  dir="ltr"
                  autoComplete="off"
                  className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
                <button type="submit" disabled={scanning || !code.trim()} className="h-10 px-4 rounded-lg bg-primary text-white text-sm disabled:opacity-50">+1</button>
              </div>
              <p className="text-xs text-muted-foreground">كل مسح يضيف قطعة واحدة.</p>
            </form>

            <div className="p-4 rounded-xl border bg-card space-y-2">
              <span className="block text-sm font-medium">اختيار المنتج وإدخال الكمية</span>
              <VariantCombobox options={scope} counted={countedQty} onPick={pick} disabled={products.isLoading} />
              {picked && (
                <form
                  onSubmit={(e) => { e.preventDefault(); saveCount(picked.variant.id, qty); }}
                  className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20"
                >
                  <span className="flex-1 min-w-[140px] text-sm">
                    <span className="font-medium">{picked.product.name}</span>
                    <span className="text-muted-foreground"> ({picked.variant.label})</span>
                  </span>
                  <input
                    autoFocus
                    aria-label="الكمية المعدودة"
                    inputMode="numeric"
                    placeholder="العدد"
                    value={qty}
                    onChange={(e) => setQty(sanitizeInt(e.target.value).slice(0, 5))}
                    className="w-20 h-9 px-2 rounded-lg border text-left"
                    dir="ltr"
                  />
                  <button type="submit" disabled={saving || qty === ''} className="h-9 px-3 rounded-lg bg-primary text-white text-sm disabled:opacity-50">حفظ</button>
                  <button type="button" onClick={() => setPicked(null)} className="h-9 px-3 rounded-lg border text-sm hover:bg-accent">إلغاء</button>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={busy !== null} className={btn}><Download className="w-4 h-4" /> ملف Excel للعد</button>
        {open && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={btn}><Upload className="w-4 h-4" /> {busy === 'upload' ? 'جاري الرفع...' : 'رفع ملف العد'}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" aria-label="ملف العد" onChange={(e) => upload(e.target.files?.[0])} />
          </>
        )}
        <button type="button" onClick={() => window.print()} disabled={products.isLoading} className={btn}><Printer className="w-4 h-4" /> طباعة ورقة العد</button>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right p-3 font-medium">المنتج</th>
              <th className="text-right p-3 font-medium">اللون/المقاس</th>
              <th className="text-right p-3 font-medium">الكود</th>
              <th className="text-right p-3 font-medium">المعدود</th>
              <th className="text-right p-3 font-medium">وقت العد</th>
              {open && <th className="p-3 w-px" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لم يتم عد أي صنف بعد</td></tr>
            )}
            {lines.map((l) => (
              <tr key={l.variantId} className="border-t">
                <td className="p-3 font-medium">{l.productName}</td>
                <td className="p-3">{l.label}</td>
                <td className="p-3 font-mono text-xs" dir="ltr">{l.variantCode}</td>
                <td className="p-3">
                  {open ? (
                    <CountInput value={l.countedQty} onSave={(v) => saveCount(l.variantId, v)} />
                  ) : (
                    <strong>{l.countedQty}</strong>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.countedAt ?? undefined)}</td>
                {open && (
                  <td className="p-3">
                    <button type="button" onClick={() => remove(l.variantId)} aria-label={`حذف عد ${l.productName}`} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Printed count sheet: blind, so no system quantities. */}
      <div className="print-area" dir="rtl">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>ورقة جرد: {stocktake.title} ({stocktake.code})</h2>
        <p style={{ fontSize: 11, marginBottom: 8 }}>النطاق: {scopeText(stocktake.types)} - التاريخ: ____________ - العادّ: ____________</p>
        <table>
          <thead>
            <tr><th>#</th><th>المنتج</th><th>اللون/المقاس</th><th>الكود</th><th style={{ width: 90 }}>العدد</th></tr>
          </thead>
          <tbody>
            {scope.map(({ product, variant }, i) => (
              <tr key={variant.id}>
                <td>{i + 1}</td>
                <td>{product.name}</td>
                <td>{variant.label}</td>
                <td dir="ltr">{variant.code}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!importResult} onClose={() => setImportResult(null)} title="نتيجة رفع ملف العد">
        {importResult && (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-success">تم تسجيل {importResult.filled} صنف.</p>
            <ResultList title="أكواد غير موجودة" items={importResult.unknown} />
            <ResultList title="خارج نطاق الجرد أو غير نشط" items={importResult.outOfScope} />
            <ResultList title="قيم غير صحيحة" items={importResult.invalid} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-medium text-destructive mb-1">{title} ({items.length})</p>
      <ul className="list-disc pr-5 space-y-0.5 max-h-40 overflow-y-auto text-muted-foreground">
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

/** Saves on Enter or when leaving the field, only if the value changed. */
function CountInput({ value, onSave }: { value: number; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setDraft(String(value));
  }
  const commit = () => {
    if (draft !== String(value)) onSave(draft);
  };
  return (
    <input
      aria-label="الكمية المعدودة"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(sanitizeInt(e.target.value).slice(0, 5))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      className="w-20 h-9 px-2 rounded-lg border text-left"
      dir="ltr"
    />
  );
}

import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { stocktakesService } from '@/api/stocktakes';
import { extractApiError } from '@/api/client';
import { STOCKTAKE_REASONS, type StocktakeReason, type StocktakeReview, type StocktakeReviewLine } from '@/types';
import { formatCurrency } from '@/utils/format';
import { MAX_NOTES } from '@/utils/validation';

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const tone = (n: number) => (n < 0 ? 'text-destructive' : n > 0 ? 'text-warning' : 'text-success');

/** System vs counted, value of the differences, and a reason per difference. */
export function ReviewTab({ review, onChanged }: { review: StocktakeReview; onChanged: () => void }) {
  const open = review.stocktake.status === 'OPEN';
  const approved = review.stocktake.status === 'APPROVED';
  const [onlyDiffs, setOnlyDiffs] = useState(true);
  const [showUncounted, setShowUncounted] = useState(false);
  const lines = onlyDiffs ? review.lines.filter((l) => l.variance !== 0) : review.lines;
  const netCost = review.surplusCost - review.shortageCost;
  const netSell = review.surplusSell - review.shortageSell;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="أصناف بها فروق" value={`${review.linesWithDifference} من ${review.lines.length}`} />
        <Card label="العجز (تكلفة / بيع)" value={`${formatCurrency(review.shortageCost)} / ${formatCurrency(review.shortageSell)} ج.م`} className="text-destructive" />
        <Card label="الزيادة (تكلفة / بيع)" value={`${formatCurrency(review.surplusCost)} / ${formatCurrency(review.surplusSell)} ج.م`} className="text-warning" />
        <Card label="الصافي (تكلفة / بيع)" value={`${formatCurrency(netCost)} / ${formatCurrency(netSell)} ج.م`} className={tone(netCost)} />
      </div>

      {open && review.uncounted.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10">
          <button type="button" onClick={() => setShowUncounted((s) => !s)} aria-expanded={showUncounted} className="w-full flex items-center justify-between gap-2 p-3 text-sm text-right">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              {review.uncounted.length} لون/مقاس لم يُعد. سيبقى مخزونه كما هو عند الاعتماد.
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showUncounted ? 'rotate-180' : ''}`} />
          </button>
          {showUncounted && (
            <ul className="px-6 pb-3 text-sm text-muted-foreground list-disc max-h-56 overflow-y-auto">
              {review.uncounted.map((u) => <li key={u.variantId}>{u.productName} ({u.label}) <span dir="ltr" className="font-mono text-xs">{u.variantCode}</span></li>)}
            </ul>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm w-fit">
        <input type="checkbox" checked={onlyDiffs} onChange={(e) => setOnlyDiffs(e.target.checked)} />
        الفروق فقط
      </label>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right p-3 font-medium">المنتج</th>
              <th className="text-right p-3 font-medium">اللون/المقاس</th>
              <th className="text-right p-3 font-medium" title="مخزون النظام لحظة العد">النظام</th>
              <th className="text-right p-3 font-medium">المعدود</th>
              <th className="text-right p-3 font-medium">الفرق</th>
              <th className="text-right p-3 font-medium">القيمة (تكلفة)</th>
              <th className="text-right p-3 font-medium">القيمة (بيع)</th>
              <th className="text-right p-3 font-medium">السبب</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{onlyDiffs ? 'لا توجد فروق' : 'لم يتم عد أي صنف'}</td></tr>
            )}
            {lines.map((l) => (
              <tr key={l.variantId} className="border-t align-top">
                <td className="p-3 font-medium">{l.productName}</td>
                <td className="p-3">{l.label}</td>
                <td className="p-3">{l.systemQty}</td>
                <td className="p-3">{l.countedQty}</td>
                <td className={`p-3 font-bold ${tone(l.variance)}`} dir="ltr">
                  {signed(l.variance)}
                  {approved && l.clamped && (
                    <span className="block text-xs font-normal text-muted-foreground" dir="rtl">طُبق {signed(l.appliedVariance ?? 0)} فقط (المخزون لا يقل عن 0)</span>
                  )}
                </td>
                <td className={`p-3 whitespace-nowrap ${tone(l.variance)}`}>{l.costValue == null ? 'بدون سعر' : `${formatCurrency(l.costValue)} ج.م`}</td>
                <td className={`p-3 whitespace-nowrap ${tone(l.variance)}`}>{l.sellValue == null ? 'بدون سعر' : `${formatCurrency(l.sellValue)} ج.م`}</td>
                <td className="p-3 min-w-[200px]">
                  {l.variance === 0 ? <span className="text-muted-foreground">-</span>
                    : open ? <ReasonEditor stocktakeId={review.stocktake.id} line={l} onSaved={onChanged} />
                      : <span>{STOCKTAKE_REASONS.find((r) => r.value === l.reason)?.label ?? '-'}{l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="p-4 rounded-xl border bg-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-base font-bold ${className}`}>{value}</p>
    </div>
  );
}

function ReasonEditor({ stocktakeId, line, onSaved }: { stocktakeId: number; line: StocktakeReviewLine; onSaved: () => void }) {
  const [note, setNote] = useState(line.note ?? '');
  const save = async (reason: StocktakeReason | null, n: string) => {
    try {
      await stocktakesService.setReason(stocktakeId, line.variantId, reason, n.trim());
      onSaved();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };
  return (
    <div className="space-y-1">
      <select
        aria-label={`سبب فرق ${line.productName}`}
        value={line.reason ?? ''}
        onChange={(e) => save((e.target.value || null) as StocktakeReason | null, note)}
        className="w-full h-9 px-2 rounded-lg border border-input bg-background text-sm"
      >
        <option value="">اختر السبب</option>
        {STOCKTAKE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <input
        aria-label={`ملاحظة فرق ${line.productName}`}
        value={note}
        maxLength={MAX_NOTES}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => { if (note.trim() !== (line.note ?? '')) save(line.reason ?? null, note); }}
        placeholder="ملاحظة (اختياري)"
        className="w-full h-9 px-2 rounded-lg border border-input bg-background text-xs"
      />
    </div>
  );
}

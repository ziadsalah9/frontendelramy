import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Save, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { cashClosingsService, type CashClosingRequest, type CashClosingResponse, type DayProfit } from '@/api/cashClosings';
import { extractApiError } from '@/api/client';
import { PageHeader, LoadingState, ErrorState, EmptyState, ConfirmDialog } from '@/components/shared/States';
import { Modal } from '@/components/shared/Modal';
import { formatCurrency, formatDate, todayLocalISO } from '@/utils/format';
import { sanitizeInt, MAX_NOTES } from '@/utils/validation';
import { useMainBranch } from '@/hooks/useMainBranch';
import { EGYPT_DENOMS } from '@/utils/cash';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';


type DenomKey = (typeof EGYPT_DENOMS)[number]['key'];
type Counts = Record<DenomKey, number>;
const ZERO_COUNTS: Counts = { count5: 0, count10: 0, count20: 0, count50: 0, count100: 0, count200: 0 };

export default function CashClosingsPage() {
  // Employees close today's cash once; past days and corrections are ADMIN-only (also enforced by the API).
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  // Single-branch mode: the closing is always for the shop's one branch.
  const { branchId: mainBranchId, isLoading: branchLoading } = useMainBranch();
  // Local date, not UTC: right after midnight in Egypt the UTC date is
  // still yesterday.
  const today = todayLocalISO();
  const [closingDate, setClosingDate] = useState<string>(today);
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS);
  const [notes, setNotes] = useState('');
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const bid = mainBranchId;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(closingDate) && closingDate <= today;

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ['cash-closings-summary', bid, closingDate],
    queryFn: () => cashClosingsService.getSummary(bid!, closingDate),
    enabled: !!bid && dateValid,
  });

  // 404 simply means the day has not been closed yet.
  const { data: existing, error: existingError, isLoading: loadingExisting } = useQuery({
    queryKey: ['cash-closing', bid, closingDate],
    queryFn: () => cashClosingsService.getByBranchAndDate(bid!, closingDate),
    enabled: !!bid && dateValid,
    retry: false,
  });
  const existingLoadFailed = !!existingError && extractApiError(existingError).status !== 404;

  useEffect(() => {
    if (existing) {
      setCounts({
        count5: existing.count5 ?? 0,
        count10: existing.count10 ?? 0,
        count20: existing.count20 ?? 0,
        count50: existing.count50 ?? 0,
        count100: existing.count100 ?? 0,
        count200: existing.count200 ?? 0,
      });
      setNotes(existing.notes ?? '');
    } else {
      setCounts(ZERO_COUNTS);
      setNotes('');
    }
  }, [existing, bid, closingDate]);

  const closeMutation = useMutation({
    mutationFn: (payload: CashClosingRequest) => cashClosingsService.close(payload),
    onSuccess: () => {
      toast.success('تم حفظ إغلاق الكاش بنجاح');
      setConfirmOpen(false);
      setOverwriteOpen(false);
      qc.invalidateQueries({ queryKey: ['cash-closing', bid, closingDate] });
      qc.invalidateQueries({ queryKey: ['cash-closings-summary', bid, closingDate] });
      qc.invalidateQueries({ queryKey: ['cash-closings'] });
    },
    onError: (err) => {
      toast.error(extractApiError(err).message);
      setConfirmOpen(false);
      setOverwriteOpen(false);
    },
  });

  const countedTotal = EGYPT_DENOMS.reduce((s, d) => s + (counts[d.key] || 0) * d.value, 0);
  const cashSalesTotal = summary?.cashSalesTotal ?? 0;
  const difference = countedTotal - cashSalesTotal;

  const sameAsExisting = (e: CashClosingResponse) =>
    EGYPT_DENOMS.every((d) => (counts[d.key] || 0) === (e[d.key] || 0)) && (notes.trim() || '') === (e.notes ?? '');

  const payload = (): CashClosingRequest => ({ branchId: bid!, closingDate, ...counts, notes: notes.trim() || undefined });

  const handleSave = () => {
    if (!bid || !dateValid || !summary || closeMutation.isPending || readOnly) return;
    if (existing) {
      if (sameAsExisting(existing)) {
        toast.info('لا توجد تغييرات على الإغلاق المسجل');
        return;
      }
      setOverwriteOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const readOnly = !isAdmin && !!existing;
  const canSave = !!bid && dateValid && !!summary && !summaryError && !existingLoadFailed && !loadingExisting && !readOnly;

  return (
    <div className="space-y-6">
      <PageHeader title="إغلاق الكاش نهاية اليوم" description="تسجيل عد الفئات المصرية (٥، ١٠، ٢٠، ٥٠، ١٠٠، ٢٠٠)" />

      <ConfirmDialog
        open={confirmOpen}
        onConfirm={() => closeMutation.mutate(payload())}
        onCancel={() => setConfirmOpen(false)}
        loading={closeMutation.isPending}
        title="تأكيد إغلاق الكاش"
        description={`المعدود ${formatCurrency(countedTotal)} ج.م مقابل مبيعات كاش ${formatCurrency(cashSalesTotal)} ج.م (الفرق ${formatCurrency(difference)} ج.م). هل تريد حفظ الإغلاق؟`}
        confirmText="حفظ الإغلاق"
      />

      <Modal open={overwriteOpen} onClose={() => setOverwriteOpen(false)} title="يوجد إغلاق كاش سابق بنفس التاريخ" maxWidth="max-w-2xl" busy={closeMutation.isPending}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-warning">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">يوجد سجل سابق لنفس التاريخ وسيتم استبداله. الفروقات مميزة أدناه.</p>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-2 font-medium">الفئة</th>
                  <th className="text-center p-2 font-medium">السجل السابق</th>
                  <th className="text-center p-2 font-medium">السجل الجديد</th>
                </tr>
              </thead>
              <tbody>
                {EGYPT_DENOMS.map((d) => {
                  const ov = existing?.[d.key] ?? 0;
                  const nv = counts[d.key] ?? 0;
                  const changed = ov !== nv;
                  return (
                    <tr key={d.key} className={changed ? 'bg-warning/10' : ''}>
                      <td className="p-2">{d.label}</td>
                      <td className="p-2 text-center">{ov}</td>
                      <td className={`p-2 text-center ${changed ? 'font-semibold text-warning' : ''}`}>{nv}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-medium">
                  <td className="p-2">المجموع المعدود</td>
                  <td className="p-2 text-center">{formatCurrency(existing?.countedTotal ?? 0)}</td>
                  <td className="p-2 text-center">{formatCurrency(countedTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {(existing?.notes || notes) && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              {existing?.notes && <div>ملاحظات سابقة: {existing.notes}</div>}
              {notes && <div className="mt-1">ملاحظات جديدة: {notes}</div>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOverwriteOpen(false)} disabled={closeMutation.isPending} className="h-10 px-4 rounded-lg border text-sm hover:bg-accent disabled:opacity-50">إلغاء</button>
            <button type="button" onClick={() => closeMutation.mutate(payload())} disabled={closeMutation.isPending} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {closeMutation.isPending ? 'جاري الحفظ...' : 'استبدال الإغلاق'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="closing-date" className="block text-sm font-medium text-foreground">تاريخ الإغلاق</label>
          <input
            id="closing-date"
            type="date"
            value={closingDate}
            max={today}
            min={isAdmin ? undefined : today}
            disabled={!isAdmin}
            onChange={(e) => setClosingDate(e.target.value)}
            className={`h-10 w-full px-3 rounded-lg border bg-background ${dateValid ? 'border-input' : 'border-destructive'}`}
          />
          {!dateValid && <p className="text-xs text-destructive">اختر تاريخاً صحيحاً لا يتجاوز اليوم</p>}
        </div>
      </div>

      {!bid && (branchLoading ? <LoadingState /> : <EmptyState title="لم يتم العثور على فرع نشط للمتجر" description="تواصل مع مدير النظام" />)}
      {bid && dateValid && loadingSummary && <LoadingState />}
      {bid && dateValid && summaryError && (
        <ErrorState message={`تعذر تحميل مبيعات الكاش لهذا اليوم: ${extractApiError(summaryError).message}`} />
      )}
      {bid && dateValid && existingLoadFailed && (
        <ErrorState message={`تعذر التحقق من وجود إغلاق سابق: ${extractApiError(existingError).message}`} />
      )}
      {bid && dateValid && summary && !summaryError && (
        <>
          {existing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-foreground">
              <CheckCircle2 className="w-4 h-4 text-success" />
              تم إغلاق هذا اليوم {existing.closedByName ? `بواسطة ${existing.closedByName}` : ''} {existing.createdAt ? `في ${formatDate(existing.createdAt)}` : ''}. أي حفظ جديد سيستبدل الإغلاق المسجل.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg bg-card"><p className="text-xs text-muted-foreground mb-1">مبيعات الكاش (المتوقعة)</p><p className="text-2xl font-bold">{formatCurrency(cashSalesTotal)} ج.م</p><p className="text-xs text-muted-foreground mt-1">كاش المبيعات والتحصيل ناقص المرتجع والمصروفات المدفوعة نقداً</p></div>
            <div className="p-4 border rounded-lg bg-card"><p className="text-xs text-muted-foreground mb-1">المجموع المعدود</p><p className="text-2xl font-bold">{formatCurrency(countedTotal)} ج.م</p></div>
            <div className="p-4 border rounded-lg bg-card">
              <p className="text-xs text-muted-foreground mb-1">الفرق</p>
              <p className={`text-2xl font-bold ${difference === 0 ? 'text-success' : difference > 0 ? 'text-warning' : 'text-destructive'}`}>{difference > 0 ? '+' : ''}{formatCurrency(difference)} ج.م</p>
              <p className="text-xs text-muted-foreground mt-1">{difference === 0 ? 'مطابق' : difference > 0 ? 'زيادة في الدرج' : 'عجز في الدرج'}</p>
            </div>
          </div>
          {summary.dayProfit && <DayProfitPanel profit={summary.dayProfit} drawerDifference={difference} counted={countedTotal > 0} />}
          <div className="border rounded-lg bg-card p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Calculator className="w-4 h-4" /> عد الفئات</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {EGYPT_DENOMS.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.value} × {counts[d.key]} = {formatCurrency(d.value * counts[d.key])} ج.م</p>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`عدد ورقات ${d.label}`}
                    value={counts[d.key] === 0 ? '' : counts[d.key]}
                    placeholder="0"
                    onChange={(e) => setCounts({ ...counts, [d.key]: Number(sanitizeInt(e.target.value).slice(0, 6)) || 0 })}
                    disabled={readOnly}
                    className="w-24 h-9 px-2 text-left border rounded-lg bg-background"
                    dir="ltr"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="closing-notes" className="block text-sm font-medium">ملاحظات</label>
            <textarea id="closing-notes" disabled={readOnly} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={MAX_NOTES} className="w-full px-3 py-2 border rounded-lg bg-background" placeholder="مثال: سبب العجز أو الزيادة..." />
          </div>
          {readOnly && (
            <p className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">تم إغلاق كاش اليوم بالفعل. تعديل الإغلاق متاح للمدير فقط.</p>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={handleSave} disabled={closeMutation.isPending || !canSave} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {existing ? 'تحديث إغلاق الكاش' : 'حفظ إغلاق الكاش'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The day's earning (admin): profit of what was sold minus expenses, then
 * corrected by the drawer - a shortage lowers it, a surplus raises it.
 */
function DayProfitPanel({ profit, drawerDifference, counted }: { profit: DayProfit; drawerDifference: number; counted: boolean }) {
  const actual = profit.netProfit + (counted ? drawerDifference : 0);
  const row = (label: string, value: number, sign = '', cls = '') => (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium whitespace-nowrap ${cls}`} dir="ltr">{sign}{formatCurrency(Math.abs(value))}</span>
    </div>
  );
  return (
    <div className="border rounded-lg bg-card p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> أرباح اليوم</h3>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="divide-y">
          {row('صافي المبيعات (بعد المرتجع)', profit.netSales)}
          {row('تكلفة البضاعة المباعة', profit.costOfSales, '− ')}
          {row('مجمل الربح', profit.grossProfit, profit.grossProfit < 0 ? '− ' : '', 'text-foreground')}
          {row('مصروفات اليوم', profit.expenses, '− ')}
          {row('صافي الربح', profit.netProfit, profit.netProfit < 0 ? '− ' : '', 'font-bold')}
          {counted && row(drawerDifference < 0 ? 'عجز الدرج' : 'زيادة الدرج', drawerDifference, drawerDifference < 0 ? '− ' : '+ ',
            drawerDifference < 0 ? 'text-destructive' : drawerDifference > 0 ? 'text-warning' : '')}
        </div>
        <div className={`flex flex-col justify-center items-center min-w-[11rem] p-4 rounded-lg ${actual >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
          <p className="text-xs text-muted-foreground mb-1">{counted ? 'الربح الفعلي بعد عد الدرج' : 'صافي الربح'}</p>
          <p className={`text-2xl font-bold ${actual >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(actual)} ج.م</p>
          {!counted && <p className="text-[11px] text-muted-foreground mt-1">اعدّ الدرج ليظهر الربح الفعلي</p>}
        </div>
      </div>
      {profit.linesWithoutCost > 0 && (
        <p className="mt-2 text-xs text-warning">{profit.linesWithoutCost} بند مباع بدون سعر تكلفة لم يُحسب في الربح. أضف سعر التكلفة للمنتج.</p>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Repeat, X } from 'lucide-react';
import { salesReturnsService } from '@/api/salesReturns';
import { productsService } from '@/api/products';
import { customerAccountsService } from '@/api/customerAccounts';
import { extractApiError } from '@/api/client';
import { PAYMENT_METHODS, type PaymentMethod, type RefundMethod, type SalesInvoice } from '@/types';
import { Modal, FormError } from '@/components/shared/Modal';
import { VariantCombobox, type VariantOption } from '@/components/stocktake/VariantCombobox';
import { formatCurrency, variantLabel } from '@/utils/format';
import { sanitizeDecimal, sanitizeInt, MAX_NOTES } from '@/utils/validation';
import { round2 } from '@/utils/pricing';

/**
 * Exchange (ADMIN): pieces back + new pieces out, in one step. Same money
 * rules as the backend (ExchangeService): the return value pays for the new
 * items; any difference is paid now (or owed), or refunded / credited.
 */
export function ExchangeDialog({ invoice, open, onClose, onDone }: { invoice: SalesInvoice; open: boolean; onClose: () => void; onDone: (newInvoiceNumber: string) => void }) {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: productsService.getAll, enabled: open });
  const account = useQuery({
    queryKey: ['customer-account', invoice.customer?.id],
    queryFn: () => customerAccountsService.getAccount(invoice.customer!.id),
    enabled: open && !!invoice.customer,
  });
  const [backQty, setBackQty] = useState<Record<number, string>>({});
  const [lines, setLines] = useState<{ option: VariantOption; qty: string }[]>([]);
  const [paid, setPaid] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [cashAmount, setCashAmount] = useState('');
  const [refund, setRefund] = useState<RefundMethod>('CASH');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // In stock, priced, active colours/sizes.
  const options = useMemo<VariantOption[]>(() => (products.data ?? [])
    .filter((p) => p.active !== false && (p.currentPrice?.sellingPrice ?? 0) > 0)
    .flatMap((p) => p.variants.filter((v) => v.active !== false && (v.quantity ?? 0) > 0).map((v) => ({ product: p, variant: v }))), [products.data]);

  const linesTotal = invoice.items.reduce((s, i) => s + (i.total ?? 0), 0);
  const ratio = linesTotal > 0 ? (invoice.total ?? 0) / linesTotal : 0;
  const unitRefund = (i: SalesInvoice['items'][number]) => round2(((i.total ?? 0) / i.quantity) * ratio);
  const returnValue = Math.min(
    round2(invoice.items.reduce((s, i) => s + unitRefund(i) * (Number(backQty[i.id]) || 0), 0)),
    round2((invoice.total ?? 0) - (invoice.returnedTotal ?? 0)),
  );
  const newTotal = round2(lines.reduce((s, l) => s + (l.option.product.currentPrice?.sellingPrice ?? 0) * (Number(l.qty) || 0), 0));
  const difference = round2(newTotal - returnValue);
  const paidNow = difference > 0 ? Math.min(Number(paid ?? difference) || 0, difference) : 0;
  const owedOther = Math.max(0, account.data?.balance ?? 0);
  const refundCash = difference < 0 ? (refund === 'CASH' ? -difference : Math.max(0, -difference - owedOther)) : 0;

  const addLine = (o: VariantOption) => setLines((ls) => ls.some((l) => l.option.variant.id === o.variant.id) ? ls : [...ls, { option: o, qty: '1' }]);

  const submit = async () => {
    if (saving) return;
    const returnItems = invoice.items.filter((i) => Number(backQty[i.id]) > 0).map((i) => ({ invoiceItemId: i.id, quantity: Number(backQty[i.id]) }));
    const newItems = lines.filter((l) => Number(l.qty) > 0).map((l) => ({ variantId: l.option.variant.id, quantity: Number(l.qty) }));
    if (returnItems.length === 0) return setError('اختر ما سيُرجعه العميل');
    if (newItems.length === 0) return setError('اختر الأصناف الجديدة');
    for (const l of lines) {
      if (Number(l.qty) > (l.option.variant.quantity ?? 0)) return setError(`المتاح من ${l.option.product.name} (${l.option.variant.label}) ${l.option.variant.quantity} فقط`);
    }
    if (difference > 0 && method === 'MIXED' && (cashAmount === '' || Number(cashAmount) > paidNow)) return setError('اكتب الجزء النقدي (لا يزيد عن المدفوع)');
    setSaving(true);
    setError('');
    try {
      const r = await salesReturnsService.exchange(invoice.id, {
        returnItems, newItems, paymentMethod: method, paid: paidNow,
        cashAmount: method === 'MIXED' ? Number(cashAmount) : undefined, refundMethod: refund, reason: reason.trim() || undefined,
      });
      toast.success(`تم الاستبدال: فاتورة جديدة ${r.newInvoice.invoiceNumber}`);
      ['sales-invoices', 'sales-returns', 'products', 'low-stock', 'customers', 'customer-account', 'cash-closings-summary', 'activity-logs', 'dashboard', 'installment-plan', 'installments-due']
        .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setBackQty({});
      setLines([]);
      setPaid(null);
      setReason('');
      onDone(r.newInvoice.invoiceNumber);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'h-9 px-2 rounded-lg border border-input bg-background text-sm';

  return (
    <Modal open={open} onClose={onClose} title={`استبدال من الفاتورة ${invoice.invoiceNumber}`} maxWidth="max-w-3xl" persistent busy={saving}>
      <div className="space-y-4">
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">١. ما يُرجعه العميل</h4>
          <div className="rounded-lg border divide-y">
            {invoice.items.map((i) => {
              const available = i.quantity - (i.returnedQuantity ?? 0);
              return (
                <div key={i.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{i.productName}{variantLabel(i) && <span className="mr-2 text-xs text-muted-foreground">({variantLabel(i)})</span>}</p>
                    <p className="text-xs text-muted-foreground">القطعة بـ {formatCurrency(unitRefund(i))} ج.م · متاح للإرجاع {available}</p>
                  </div>
                  {available > 0 && (
                    <input aria-label={`كمية إرجاع ${i.productName}`} inputMode="numeric" value={backQty[i.id] ?? ''} placeholder="0" dir="ltr"
                      onChange={(e) => { const n = sanitizeInt(e.target.value); setBackQty((q) => ({ ...q, [i.id]: n === '' ? '' : String(Math.min(Number(n), available)) })); }}
                      className={`w-16 text-left ${inputCls}`} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">٢. الأصناف الجديدة</h4>
          <VariantCombobox options={options} counted={new Map()} onPick={addLine} disabled={products.isLoading} />
          {lines.length > 0 && (
            <div className="rounded-lg border divide-y">
              {lines.map((l, idx) => (
                <div key={l.option.variant.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium">{l.option.product.name} <span className="text-xs text-muted-foreground">({l.option.variant.label})</span></p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(l.option.product.currentPrice?.sellingPrice)} ج.م · المتاح {l.option.variant.quantity}</p>
                  </div>
                  <input aria-label="الكمية" inputMode="numeric" value={l.qty} dir="ltr" className={`w-16 text-left ${inputCls}`}
                    onChange={(e) => { const v = sanitizeInt(e.target.value); setLines((ls) => ls.map((x, j) => (j === idx ? { ...x, qty: v } : x))); }} />
                  <button type="button" aria-label="حذف" onClick={() => setLines((ls) => ls.filter((_, j) => j !== idx))} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <div><p className="text-xs text-muted-foreground">قيمة المرتجع</p><p className="font-bold">{formatCurrency(returnValue)} ج.م</p></div>
          <div><p className="text-xs text-muted-foreground">قيمة الجديد</p><p className="font-bold">{formatCurrency(newTotal)} ج.م</p></div>
          <div>
            <p className="text-xs text-muted-foreground">{difference > 0 ? 'يدفع العميل' : difference < 0 ? 'يُرد للعميل' : 'الفرق'}</p>
            <p className={`font-bold ${difference > 0 ? 'text-primary' : difference < 0 ? 'text-warning' : 'text-success'}`}>{formatCurrency(Math.abs(difference))} ج.م</p>
          </div>
        </section>

        {difference > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm space-y-1">
              <span className="block font-medium">المدفوع الآن (ج.م)</span>
              <input value={paid ?? String(difference)} onChange={(e) => setPaid(sanitizeDecimal(e.target.value))} dir="ltr" inputMode="decimal" className={`w-full ${inputCls}`} />
              {paidNow < difference && <span className="block text-xs text-warning">الباقي {formatCurrency(round2(difference - paidNow))} على حساب العميل</span>}
            </label>
            <label className="text-sm space-y-1">
              <span className="block font-medium">طريقة الدفع</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={`w-full ${inputCls}`}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            {method === 'MIXED' && (
              <label className="text-sm space-y-1">
                <span className="block font-medium">منه نقداً</span>
                <input value={cashAmount} onChange={(e) => setCashAmount(sanitizeDecimal(e.target.value))} dir="ltr" inputMode="decimal" className={`w-full ${inputCls}`} />
              </label>
            )}
          </div>
        )}
        {difference < 0 && (
          <fieldset className="space-y-1 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="ex-refund" checked={refund === 'CASH'} onChange={() => setRefund('CASH')} /> رد الفرق نقداً ({formatCurrency(-difference)} ج.م)</label>
            <label className="flex items-center gap-2"><input type="radio" name="ex-refund" checked={refund === 'CREDIT'} onChange={() => setRefund('CREDIT')} />
              خصمه من المستحق على العميل{account.data && ` (عليه ${formatCurrency(owedOther)})`}، والباقي نقداً ({formatCurrency(refundCash)})</label>
          </fieldset>
        )}

        <div>
          <label htmlFor="ex-reason" className="block text-sm font-medium mb-1">السبب</label>
          <textarea id="ex-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_NOTES} rows={2} placeholder="مثال: تغيير المقاس"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </div>

        <FormError message={error} />
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 px-4 rounded-lg border text-sm hover:bg-accent disabled:opacity-50">إلغاء</button>
          <button type="button" onClick={submit} disabled={saving || returnValue <= 0 || newTotal <= 0}
            className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Repeat className="w-4 h-4" /> {saving ? 'جاري الاستبدال...' : 'تأكيد الاستبدال'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

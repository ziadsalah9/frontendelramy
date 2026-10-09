import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { salesReturnsService } from '@/api/salesReturns';
import { customerAccountsService } from '@/api/customerAccounts';
import { extractApiError } from '@/api/client';
import type { RefundMethod, SalesInvoice } from '@/types';
import { Modal, FormError } from '@/components/shared/Modal';
import { formatCurrency, variantLabel } from '@/utils/format';
import { sanitizeInt, MAX_NOTES } from '@/utils/validation';
import { round2 } from '@/utils/pricing';

/**
 * Return some or all pieces of a sale (ADMIN). Each piece is refunded at
 * what the customer paid for it (line and invoice discounts included), the
 * same rule as the backend (SalesReturnService).
 */
export function ReturnDialog({ invoice, open, onClose, onDone }: { invoice: SalesInvoice; open: boolean; onClose: () => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [qty, setQty] = useState<Record<number, string>>({});
  const [method, setMethod] = useState<RefundMethod>('CASH');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const customerId = invoice.customer?.id;
  const account = useQuery({
    queryKey: ['customer-account', customerId],
    queryFn: () => customerAccountsService.getAccount(customerId!),
    enabled: open && !!customerId,
  });

  const linesTotal = invoice.items.reduce((s, i) => s + (i.total ?? 0), 0);
  const ratio = linesTotal > 0 ? (invoice.total ?? 0) / linesTotal : 0;
  const unitRefund = (i: SalesInvoice['items'][number]) => round2(((i.total ?? 0) / i.quantity) * ratio);

  // Never more than what is left of the invoice (as the backend caps it).
  const value = Math.min(
    round2(invoice.items.reduce((sum, i) => sum + unitRefund(i) * (Number(qty[i.id]) || 0), 0)),
    round2((invoice.total ?? 0) - (invoice.returnedTotal ?? 0)),
  );

  const owed = Math.max(0, account.data?.balance ?? 0);
  const credit = method === 'CREDIT' ? Math.min(value, owed) : 0;
  const cash = round2(value - credit);

  const setLine = (id: number, raw: string, max: number) => {
    const n = sanitizeInt(raw);
    setQty((q) => ({ ...q, [id]: n === '' ? '' : String(Math.min(Number(n), max)) }));
  };

  const submit = async () => {
    if (saving) return;
    const items = invoice.items
      .filter((i) => Number(qty[i.id]) > 0)
      .map((i) => ({ invoiceItemId: i.id, quantity: Number(qty[i.id]) }));
    if (items.length === 0) return setError('اختر كمية صنف واحد على الأقل للإرجاع');
    setSaving(true);
    setError('');
    try {
      const r = await salesReturnsService.create(invoice.id, { items, refundMethod: method, reason: reason.trim() || undefined });
      toast.success(`تم تسجيل المرتجع ${r.returnNumber}: ${formatCurrency(r.total)} ج.م`);
      ['sales-invoices', 'sales-returns', 'products', 'low-stock', 'customers', 'customer-account', 'cash-closings-summary', 'activity-logs']
        .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setQty({});
      setReason('');
      onDone();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`مرتجع من الفاتورة ${invoice.invoiceNumber}`} maxWidth="max-w-2xl" persistent busy={saving}>
      <div className="space-y-4">
        <div className="rounded-lg border divide-y">
          {invoice.items.map((i) => {
            const available = i.quantity - (i.returnedQuantity ?? 0);
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-medium">{i.productName}{variantLabel(i) && <span className="mr-2 text-xs text-muted-foreground">({variantLabel(i)})</span>}</p>
                  <p className="text-xs text-muted-foreground">
                    بيع {i.quantity}{(i.returnedQuantity ?? 0) > 0 && ` · رُد ${i.returnedQuantity}`} · سعر الإرجاع للقطعة {formatCurrency(unitRefund(i))} ج.م
                  </p>
                </div>
                {available > 0 ? (
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`كمية إرجاع ${i.productName}`}
                      inputMode="numeric"
                      value={qty[i.id] ?? ''}
                      onChange={(e) => setLine(i.id, e.target.value, available)}
                      placeholder="0"
                      dir="ltr"
                      className="w-16 h-9 px-2 rounded-lg border border-input bg-background text-sm text-left"
                    />
                    <span className="text-xs text-muted-foreground">من {available}</span>
                    <button type="button" onClick={() => setQty((q) => ({ ...q, [i.id]: String(available) }))} className="text-xs text-primary hover:underline">الكل</button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">تم إرجاعه بالكامل</span>
                )}
              </div>
            );
          })}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium mb-1">رد المبلغ</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="refund" checked={method === 'CASH'} onChange={() => setMethod('CASH')} /> نقداً للعميل
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="refund" checked={method === 'CREDIT'} onChange={() => setMethod('CREDIT')} disabled={!customerId} />
            خصم من المستحق على العميل{account.data && ` (عليه ${formatCurrency(owed)} ج.م)`}، والباقي نقداً
          </label>
        </fieldset>

        <div>
          <label htmlFor="return-reason" className="block text-sm font-medium mb-1">السبب</label>
          <textarea id="return-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_NOTES} rows={2}
            placeholder="مثال: عيب في الصناعة" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" />
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <div><p className="text-xs text-muted-foreground">قيمة المرتجع</p><p className="font-bold">{formatCurrency(value)} ج.م</p></div>
          <div><p className="text-xs text-muted-foreground">يُرد نقداً</p><p className="font-bold text-warning">{formatCurrency(cash)} ج.م</p></div>
          <div><p className="text-xs text-muted-foreground">يُخصم من المستحق</p><p className="font-bold">{formatCurrency(credit)} ج.م</p></div>
        </div>

        <FormError message={error} />
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 px-4 rounded-lg border text-sm hover:bg-accent disabled:opacity-50">إلغاء</button>
          <button type="button" onClick={submit} disabled={saving || value <= 0} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Undo2 className="w-4 h-4" /> {saving ? 'جاري التسجيل...' : 'تسجيل المرتجع'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

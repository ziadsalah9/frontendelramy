import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Undo2, Printer } from 'lucide-react';
import { salesReturnsService } from '@/api/salesReturns';
import { salesInvoicesService } from '@/api/salesInvoices';
import type { SalesInvoice } from '@/types';
import { Badge } from '@/components/shared/DataTable';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, getPaymentMethodLabel, variantLabel } from '@/utils/format';
import { ReturnDialog } from './ReturnDialog';
import { InstallmentSchedule } from './InstallmentSchedule';
import { printReceipt } from '@/utils/print';
import { useStoreSettings } from '@/hooks/useStoreSettings';

/**
 * A sales invoice as shown in the sales and receipts screens: totals, the
 * cash part of a mixed payment, items with what was returned, the returns
 * made on it, and (ADMIN) the button to return items.
 */
export function SalesInvoiceDetails({ invoice: initial, actions }: { invoice: SalesInvoice; actions?: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const settings = useStoreSettings();
  const [invoice, setInvoice] = useState(initial);
  const [returnOpen, setReturnOpen] = useState(false);
  if (initial.id !== invoice.id) setInvoice(initial);

  const returns = useQuery({
    queryKey: ['sales-returns', 'invoice', invoice.id],
    queryFn: () => salesReturnsService.forInvoice(invoice.id),
    enabled: (invoice.returnedTotal ?? 0) > 0,
  });

  const returnable = invoice.items.some((i) => i.quantity - (i.returnedQuantity ?? 0) > 0);
  const returned = invoice.returnedTotal ?? 0;

  const afterReturn = async () => {
    setReturnOpen(false);
    setInvoice(await salesInvoicesService.getById(invoice.id));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">العميل</p>
          <p className="text-sm font-medium">{invoice.customer?.name ?? '-'}</p>
          {invoice.customer?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{invoice.customer.phone}</p>}
        </div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الكاشير</p><p className="text-sm font-medium">{invoice.cashierName ?? '-'}</p></div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">طريقة الدفع</p>
          <Badge variant="info">{getPaymentMethodLabel(invoice.paymentMethod)}</Badge>
          {invoice.paymentMethod === 'MIXED' && invoice.cashAmount != null && (
            <p className="text-xs text-muted-foreground mt-1">منه نقداً {formatCurrency(invoice.cashAmount)} ج.م</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">خصم الفاتورة</p><p className="font-bold">{formatCurrency(invoice.discount)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">الإجمالي</p><p className="font-bold">{formatCurrency(invoice.total)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المدفوع</p><p className="text-success font-bold">{formatCurrency(invoice.paid)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المتبقي</p><p className={(invoice.remaining ?? 0) > 0 ? 'text-destructive font-bold' : 'font-bold'}>{formatCurrency(invoice.remaining)} ج.م</p></div>
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-3">المنتجات</h4>
        <div className="space-y-2">
          {invoice.items.map((item, i) => (
            <div key={item.id ?? i} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">
                  {item.productName ?? `#${item.productId}`}
                  {variantLabel(item) && <span className="mr-2 px-1.5 py-0.5 rounded bg-muted text-xs font-normal">{variantLabel(item)}</span>}
                  {(item.returnedQuantity ?? 0) > 0 && <span className="mr-2"><Badge variant="warning">رُد {item.returnedQuantity}</Badge></span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unitPrice)} ج.م
                  {item.discount > 0 && ` - خصم ${formatCurrency(item.discount)} ج.م`}
                </p>
              </div>
              <span className="text-sm font-bold">{formatCurrency(item.total)} ج.م</span>
            </div>
          ))}
        </div>
      </div>

      {returned > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground">المرتجعات <span className="text-sm font-normal text-warning">({formatCurrency(returned)} ج.م)</span></h4>
          {returns.data?.map((r) => (
            <div key={r.id} className="p-3 rounded-lg border border-warning/30 bg-warning/5 text-sm space-y-1">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-mono" dir="ltr">{r.returnNumber}</span>
                <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}{r.createdByName && ` · ${r.createdByName}`}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {r.items.map((it) => `${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ''} × ${it.quantity}`).join('، ')}
              </p>
              <p className="text-xs">
                القيمة {formatCurrency(r.total)} ج.م · نقداً {formatCurrency(r.cashRefund)} · من المستحق {formatCurrency(r.creditAmount)}
                {r.reason && ` · ${r.reason}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {(invoice.remaining ?? 0) > 0 && <InstallmentSchedule invoiceId={invoice.id} />}

      <p className="text-xs text-muted-foreground">التاريخ: {formatDate(invoice.createdAt)}</p>
      {invoice.notes && <div><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-sm">{invoice.notes}</p></div>}

      {(
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
          {actions}
          <button type="button" onClick={() => printReceipt(invoice, settings.data)} className="flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-medium hover:bg-accent">
            <Printer className="w-4 h-4" /> طباعة الإيصال
          </button>
          {isAdmin && returnable && (
            <button type="button" onClick={() => setReturnOpen(true)} className="flex items-center gap-2 h-10 px-4 rounded-lg border border-warning/50 text-warning text-sm font-medium hover:bg-warning/10">
              <Undo2 className="w-4 h-4" /> إرجاع أصناف
            </button>
          )}
        </div>
      )}

      {isAdmin && <ReturnDialog invoice={invoice} open={returnOpen} onClose={() => setReturnOpen(false)} onDone={afterReturn} />}
    </div>
  );
}

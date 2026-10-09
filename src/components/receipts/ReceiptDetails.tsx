import type { CustomerPayment, PurchaseInvoice, SalesReturn } from '@/types';
import type { CashClosingResponse } from '@/api/cashClosings';
import { Badge } from '@/components/shared/DataTable';
import { ClosedBranchBadge } from '@/components/shared/ClosedBranchBadge';
import { formatCurrency, formatDate, getPaymentMethodLabel, variantLabel } from '@/utils/format';
import { EGYPT_DENOMS } from '@/utils/cash';

// Detail views of the receipts screen (sales use SalesInvoiceDetails).

export function PurchaseInvoiceDetails({ invoice: inv }: { invoice: PurchaseInvoice }) {
  return (
    <div className="space-y-4">
      <ClosedBranchBadge branchId={inv.branchId} branchName={inv.branchName} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">التاريخ</p><p className="text-sm font-medium">{formatDate(inv.createdAt)}</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">طريقة الدفع</p>{inv.paymentMethod ? <Badge variant="info">{getPaymentMethodLabel(inv.paymentMethod)}</Badge> : '-'}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">خصم الفاتورة</p><p className="font-bold">{formatCurrency(inv.discount)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">الإجمالي</p><p className="font-bold">{formatCurrency(inv.total)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المدفوع</p><p className="font-bold text-success">{formatCurrency(inv.paid)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المتبقي</p><p className={`font-bold ${(inv.remaining ?? 0) > 0 ? 'text-destructive' : ''}`}>{formatCurrency(inv.remaining)} ج.م</p></div>
      </div>
      <div>
        <h4 className="font-semibold text-foreground mb-3">المنتجات</h4>
        <div className="space-y-2">
          {inv.items?.map((item, i) => (
            <div key={item.id ?? i} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">{item.productName ?? `#${item.productId}`}{variantLabel(item) && <span className="mr-2 px-1.5 py-0.5 rounded bg-muted text-xs font-normal">{variantLabel(item)}</span>}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatCurrency(item.unitPrice)} ج.م
                  {item.discount > 0 && ` - خصم ${formatCurrency(item.discount)} ج.م`}
                </p>
              </div>
              <span className="text-sm font-bold">{formatCurrency(item.total ?? item.quantity * (item.unitPrice ?? 0) - item.discount)} ج.م</span>
            </div>
          ))}
        </div>
      </div>
      {inv.notes && <div><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-sm">{inv.notes}</p></div>}
    </div>
  );
}

export function CashClosingDetails({ closing }: { closing: CashClosingResponse }) {
  const diff = closing.difference ?? 0;
  return (
    <div className="space-y-4">
      <ClosedBranchBadge branchId={closing.branchId} branchName={closing.branchName} />
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">تاريخ الإغلاق</p><p className="text-sm font-medium" dir="ltr">{closing.closingDate}</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">بواسطة</p><p className="text-sm font-medium">{closing.closedByName ?? '-'}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">مبيعات الكاش</p><p className="font-bold">{formatCurrency(closing.cashSalesTotal)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المعدود</p><p className="font-bold">{formatCurrency(closing.countedTotal)} ج.م</p></div>
        <div className="p-3 rounded-lg border">
          <p className="text-xs text-muted-foreground mb-1">الفرق</p>
          <p className={`font-bold ${diff === 0 ? 'text-success' : diff > 0 ? 'text-warning' : 'text-destructive'}`}>{diff > 0 ? '+' : ''}{formatCurrency(diff)} ج.م</p>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr><th className="text-right p-2 font-medium">الفئة</th><th className="text-center p-2 font-medium">العدد</th><th className="text-left p-2 font-medium">القيمة</th></tr>
          </thead>
          <tbody>
            {EGYPT_DENOMS.map((d) => (
              <tr key={d.key} className="border-t">
                <td className="p-2">{d.label}</td>
                <td className="p-2 text-center">{closing[d.key] ?? 0}</td>
                <td className="p-2 text-left">{formatCurrency((closing[d.key] ?? 0) * d.value)} ج.م</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {closing.createdAt && <p className="text-xs text-muted-foreground">تم الحفظ: {formatDate(closing.createdAt)}</p>}
      {closing.notes && <div><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-sm">{closing.notes}</p></div>}
    </div>
  );
}

export function ReturnDetails({ ret }: { ret: SalesReturn }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">العميل</p><p className="text-sm font-medium">{ret.customerName ?? '-'}</p>{ret.customerPhone && <p className="text-xs text-muted-foreground" dir="ltr">{ret.customerPhone}</p>}</div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">من الفاتورة</p><p className="text-sm font-mono" dir="ltr">{ret.invoiceNumber}</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">بواسطة</p><p className="text-sm font-medium">{ret.createdByName ?? '-'}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">القيمة</p><p className="font-bold text-destructive">{formatCurrency(ret.total)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">رُد نقداً</p><p className="font-bold">{formatCurrency(ret.cashRefund)} ج.م</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">خُصم من المستحق</p><p className="font-bold">{formatCurrency(ret.creditAmount)} ج.م</p></div>
      </div>
      <div className="space-y-2">
        {ret.items.map((it) => (
          <div key={it.invoiceItemId} className="flex items-center justify-between p-3 rounded-lg border text-sm">
            <span>{it.productName}{it.variantLabel && <span className="mr-2 text-xs text-muted-foreground">({it.variantLabel})</span>} × {it.quantity}</span>
            <span className="font-bold">{formatCurrency(it.total)} ج.م</span>
          </div>
        ))}
      </div>
      {ret.reason && <p className="text-sm"><span className="text-muted-foreground">السبب: </span>{ret.reason}</p>}
      <p className="text-xs text-muted-foreground">التاريخ: {formatDate(ret.createdAt)}</p>
    </div>
  );
}

export function PaymentDetails({ payment }: { payment: CustomerPayment }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">العميل</p><p className="text-sm font-medium">{payment.customerName}</p>{payment.customerPhone && <p className="text-xs text-muted-foreground" dir="ltr">{payment.customerPhone}</p>}</div>
      <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">المبلغ</p><p className="text-lg font-bold text-success">{formatCurrency(payment.amount)} ج.م</p></div>
      <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">طريقة الدفع</p><Badge variant="info">{getPaymentMethodLabel(payment.paymentMethod)}</Badge></div>
      <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">استلمه</p><p className="text-sm font-medium">{payment.receivedByName ?? '-'}</p></div>
      {payment.notes && <p className="col-span-2 text-sm"><span className="text-muted-foreground">ملاحظات: </span>{payment.notes}</p>}
      <p className="col-span-2 text-xs text-muted-foreground">التاريخ: {formatDate(payment.createdAt)}</p>
    </div>
  );
}

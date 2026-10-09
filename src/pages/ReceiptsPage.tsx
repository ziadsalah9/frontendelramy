import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Receipt, ShoppingCart, Calculator, AlertTriangle, Undo2, Wallet } from 'lucide-react';
import { salesInvoicesService } from '@/api/salesInvoices';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { cashClosingsService, type CashClosingResponse } from '@/api/cashClosings';
import { extractApiError } from '@/api/client';
import type { PurchaseInvoice, SalesInvoice, PaymentMethod, SalesReturn, CustomerPayment } from '@/types';
import { salesReturnsService } from '@/api/salesReturns';
import { customerAccountsService } from '@/api/customerAccounts';
import { SalesInvoiceDetails } from '@/components/sales/SalesInvoiceDetails';
import { round2 } from '@/utils/pricing';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { formatCurrency, formatDate, getPaymentMethodLabel, variantLabel } from '@/utils/format';
import { matches } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { ClosedBranchBadge } from '@/components/shared/ClosedBranchBadge';

type Kind = 'SALE' | 'RETURN' | 'PAYMENT' | 'PURCHASE' | 'CASH_CLOSING';

/** One row of the unified list, whatever document it came from. */
interface ReceiptRow {
  id: string;
  kind: Kind;
  number: string;
  /** Sort / filter key. */
  timestamp: number;
  /** yyyy-MM-dd in local time, for the date filter. */
  day: string;
  dateLabel: string;
  branchId: number;
  branchName: string;
  party: string;
  total: number;
  paid?: number;
  /** Remaining balance for invoices, counted - expected for cash closings. */
  balance: number;
  paymentMethod?: PaymentMethod;
  source: SalesInvoice | PurchaseInvoice | CashClosingResponse | SalesReturn | CustomerPayment;
}

const KIND_META: Record<Kind, { label: string; variant: 'info' | 'warning' | 'success' | 'destructive' | 'default'; icon: typeof Receipt }> = {
  SALE: { label: 'فاتورة بيع', variant: 'info', icon: Receipt },
  RETURN: { label: 'مرتجع', variant: 'destructive', icon: Undo2 },
  PAYMENT: { label: 'تحصيل', variant: 'default', icon: Wallet },
  PURCHASE: { label: 'فاتورة شراء', variant: 'warning', icon: ShoppingCart },
  CASH_CLOSING: { label: 'إغلاق كاش', variant: 'success', icon: Calculator },
};

const PAGE_SIZE = 50;

const localDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DENOMS = [
  { key: 'count5', label: '٥ جنيه', value: 5 },
  { key: 'count10', label: '١٠ جنيه', value: 10 },
  { key: 'count20', label: '٢٠ جنيه', value: 20 },
  { key: 'count50', label: '٥٠ جنيه', value: 50 },
  { key: 'count100', label: '١٠٠ جنيه', value: 100 },
  { key: 'count200', label: '٢٠٠ جنيه', value: 200 },
] as const;

export default function ReceiptsPage() {
  const { user, isAdmin } = useAuth();
  const ownBranchId = user?.branchId ?? undefined;

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<Kind | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [viewing, setViewing] = useState<ReceiptRow | null>(null);


  // The backend already scopes sales invoices to an employee's branch.
  const sales = useQuery({ queryKey: ['sales-invoices'], queryFn: salesInvoicesService.getAll });
  // Purchase invoices are ADMIN-only end to end.
  const purchases = useQuery({ queryKey: ['purchase-invoices'], queryFn: purchaseInvoicesService.getAll, enabled: isAdmin });
  // GET /api/cash-closings is ADMIN-only; employees read their own branch.
  const returnsQ = useQuery({ queryKey: ['sales-returns'], queryFn: salesReturnsService.getAll });
  const paymentsQ = useQuery({ queryKey: ['customer-payments'], queryFn: customerAccountsService.getAllPayments });
  const closings = useQuery({
    queryKey: ['cash-closings', isAdmin ? 'all' : ownBranchId],
    queryFn: () => (isAdmin ? cashClosingsService.getAll() : cashClosingsService.getByBranch(ownBranchId!)),
    enabled: isAdmin || !!ownBranchId,
  });

  const rows = useMemo<ReceiptRow[]>(() => {
    const branchName = (id: number, fallback?: string) => fallback ?? `#${id}`;
    const out: ReceiptRow[] = [];
    for (const inv of sales.data ?? []) {
      out.push({
        id: `SALE-${inv.id}`,
        kind: 'SALE',
        number: inv.invoiceNumber,
        timestamp: new Date(inv.createdAt).getTime(),
        day: localDay(inv.createdAt),
        dateLabel: formatDate(inv.createdAt),
        branchId: inv.branchId,
        branchName: branchName(inv.branchId, inv.branchName),
        party: inv.customer?.name ?? '-',
        total: inv.total ?? 0,
        paid: inv.paid ?? 0,
        balance: inv.remaining ?? 0,
        paymentMethod: inv.paymentMethod,
        source: inv,
      });
    }
    for (const inv of isAdmin ? purchases.data ?? [] : []) {
      out.push({
        id: `PURCHASE-${inv.id}`,
        kind: 'PURCHASE',
        number: inv.invoiceNumber,
        timestamp: new Date(inv.createdAt).getTime(),
        day: localDay(inv.createdAt),
        dateLabel: formatDate(inv.createdAt),
        branchId: inv.branchId,
        branchName: branchName(inv.branchId, inv.branchName),
        party: 'مورد',
        total: inv.total ?? 0,
        paid: inv.paid ?? 0,
        balance: inv.remaining ?? 0,
        paymentMethod: inv.paymentMethod,
        source: inv,
      });
    }
    for (const r of returnsQ.data ?? []) {
      out.push({
        id: `RETURN-${r.id}`,
        kind: 'RETURN',
        number: r.returnNumber,
        timestamp: new Date(r.createdAt).getTime(),
        day: localDay(r.createdAt),
        dateLabel: formatDate(r.createdAt),
        branchId: r.branchId ?? 0,
        branchName: branchName(r.branchId ?? 0),
        party: r.customerName ?? '-',
        total: r.total,
        balance: r.cashRefund,
        source: r,
      });
    }
    for (const p of paymentsQ.data ?? []) {
      out.push({
        id: `PAYMENT-${p.id}`,
        kind: 'PAYMENT',
        number: p.paymentNumber,
        timestamp: new Date(p.createdAt).getTime(),
        day: localDay(p.createdAt),
        dateLabel: formatDate(p.createdAt),
        branchId: p.branchId ?? 0,
        branchName: branchName(p.branchId ?? 0, p.branchName ?? undefined),
        party: p.customerName,
        total: p.amount,
        paid: p.amount,
        balance: 0,
        paymentMethod: p.paymentMethod,
        source: p,
      });
    }
    for (const c of closings.data ?? []) {
      out.push({
        id: `CASH-${c.id}`,
        kind: 'CASH_CLOSING',
        number: `CLOSE-${c.closingDate}`,
        // A closing belongs to its business day, not to when it was saved.
        timestamp: new Date(c.createdAt ?? c.closingDate).getTime(),
        day: c.closingDate,
        dateLabel: c.closingDate,
        branchId: c.branchId,
        branchName: branchName(c.branchId, c.branchName),
        party: c.closedByName ?? '-',
        total: c.countedTotal ?? 0,
        balance: c.difference ?? 0,
        source: c,
      });
    }
    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales.data, purchases.data, closings.data, returnsQ.data, paymentsQ.data, isAdmin]);

  // Everything except the type filter, so the type tabs can show counts.
  const baseFiltered = rows.filter(
    (r) =>
      (!fromDate || r.day >= fromDate) &&
      (!toDate || r.day <= toDate) &&
      (matches(r.number, search) || matches(r.party, search)),
  );
  const filtered = kindFilter === 'ALL' ? baseFiltered : baseFiltered.filter((r) => r.kind === kindFilter);
  const visible = filtered.slice(0, limit);

  const countOf = (k: Kind) => baseFiltered.filter((r) => r.kind === k).length;
  const sum = (k: Kind, f: (r: ReceiptRow) => number) => baseFiltered.filter((r) => r.kind === k).reduce((s, r) => s + f(r), 0);
  const returnsTotal = sum('RETURN', (r) => r.total);
  const salesTotal = round2(sum('SALE', (r) => r.total) - returnsTotal);
  const paymentsTotal = sum('PAYMENT', (r) => r.total);
  const salesDue = sum('SALE', (r) => r.balance);
  const purchasesTotal = sum('PURCHASE', (r) => r.total);
  const closingsDiff = sum('CASH_CLOSING', (r) => r.balance);

  const loading = sales.isLoading || (isAdmin && purchases.isLoading) || closings.isLoading || returnsQ.isLoading || paymentsQ.isLoading;
  const failed = [
    sales.error && 'فواتير البيع',
    isAdmin && purchases.error && 'فواتير الشراء',
    closings.error && 'إغلاقات الكاش',
    returnsQ.error && 'المرتجعات',
    paymentsQ.error && 'التحصيلات',
  ].filter(Boolean) as string[];
  const allFailed = failed.length > 0 && rows.length === 0;

  const resetPaging = () => setLimit(PAGE_SIZE);

  const kinds: Kind[] = isAdmin ? ['SALE', 'RETURN', 'PAYMENT', 'PURCHASE', 'CASH_CLOSING'] : ['SALE', 'RETURN', 'PAYMENT', 'CASH_CLOSING'];

  const columns: Column<ReceiptRow>[] = [
    { key: 'kind', header: 'النوع', render: (r) => <Badge variant={KIND_META[r.kind].variant}>{KIND_META[r.kind].label}</Badge> },
    {
      key: 'number', header: 'الرقم',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium" dir="ltr">{r.number}</span>
          {/* Single-branch mode: history from the closed branch is labelled. */}
          <ClosedBranchBadge branchId={r.branchId} branchName={r.branchName} />
        </div>
      ),
    },
    { key: 'date', header: 'التاريخ', render: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{r.dateLabel}</span> },
    { key: 'party', header: 'العميل / المسؤول', render: (r) => r.party },
    {
      key: 'total', header: 'الإجمالي',
      render: (r) => <span className={`font-bold whitespace-nowrap ${r.kind === 'RETURN' ? 'text-destructive' : r.kind === 'PAYMENT' ? 'text-success' : ''}`}>{r.kind === 'RETURN' ? '-' : ''}{formatCurrency(r.total)} ج.م</span>,
    },
    {
      key: 'balance', header: 'المتبقي / الفرق',
      render: (r) => r.kind === 'RETURN'
        ? <span className="whitespace-nowrap text-xs text-muted-foreground">نقداً {formatCurrency(r.balance)} ج.م</span>
        : r.kind === 'PAYMENT'
        ? <span className="text-muted-foreground">-</span>
        : r.kind === 'CASH_CLOSING'
        ? <span className={`whitespace-nowrap font-medium ${r.balance === 0 ? 'text-success' : r.balance > 0 ? 'text-warning' : 'text-destructive'}`}>{r.balance > 0 ? '+' : ''}{formatCurrency(r.balance)} ج.م</span>
        : <span className={`whitespace-nowrap ${r.balance > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{formatCurrency(r.balance)} ج.م</span>,
    },
    { key: 'actions', header: '', className: 'text-left w-px', render: (r) => <ActionButton onClick={() => setViewing(r)} icon={Eye} label="عرض التفاصيل" /> },
  ];

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${active ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div>
      <PageHeader title="الفواتير والإيصالات" description="كل فواتير البيع والشراء وإغلاقات الكاش في مكان واحد" />

      <div className={`grid grid-cols-2 gap-3 mb-4 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">صافي المبيعات</p><p className="text-xl font-bold">{formatCurrency(salesTotal)} ج.م</p><p className="text-xs text-muted-foreground">{countOf('SALE')} فاتورة{returnsTotal > 0 && ` · مرتجعات ${formatCurrency(returnsTotal)}`}{paymentsTotal > 0 && ` · تحصيلات ${formatCurrency(paymentsTotal)}`}</p></div>
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">مستحقات على العملاء</p><p className={`text-xl font-bold ${salesDue > 0 ? 'text-destructive' : ''}`}>{formatCurrency(salesDue)} ج.م</p></div>
        {isAdmin && <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">إجمالي المشتريات</p><p className="text-xl font-bold">{formatCurrency(purchasesTotal)} ج.م</p><p className="text-xs text-muted-foreground">{countOf('PURCHASE')} فاتورة</p></div>}
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">صافي فروق الكاش</p><p className={`text-xl font-bold ${closingsDiff === 0 ? 'text-success' : closingsDiff > 0 ? 'text-warning' : 'text-destructive'}`}>{closingsDiff > 0 ? '+' : ''}{formatCurrency(closingsDiff)} ج.م</p><p className="text-xs text-muted-foreground">{countOf('CASH_CLOSING')} إغلاق</p></div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit max-w-full overflow-x-auto" role="tablist">
          <button type="button" role="tab" aria-selected={kindFilter === 'ALL'} onClick={() => { setKindFilter('ALL'); resetPaging(); }} className={tabCls(kindFilter === 'ALL')}>الكل ({baseFiltered.length})</button>
          {kinds.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kindFilter === k} onClick={() => { setKindFilter(k); resetPaging(); }} className={tabCls(kindFilter === k)}>
              {KIND_META[k].label} ({countOf(k)})
            </button>
          ))}
        </div>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <SearchInput value={search} onChange={(v) => { setSearch(v); resetPaging(); }} placeholder="بحث بالرقم أو العميل..." />
          <div className="flex items-center gap-2">
            <label htmlFor="from-date" className="text-sm text-muted-foreground whitespace-nowrap">من</label>
            <input id="from-date" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); resetPaging(); }} className="h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            <label htmlFor="to-date" className="text-sm text-muted-foreground whitespace-nowrap">إلى</label>
            <input id="to-date" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); resetPaging(); }} className="h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            {(fromDate || toDate || search) && (
              <button type="button" onClick={() => { setFromDate(''); setToDate(''); setSearch(''); resetPaging(); }} className="text-sm text-primary hover:underline whitespace-nowrap">مسح الفلاتر</button>
            )}
          </div>
        </div>
      </div>

      {failed.length > 0 && !allFailed && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-foreground">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          تعذر تحميل: {failed.join('، ')}. القائمة تعرض الباقي فقط.
        </div>
      )}

      <DataTable
        columns={columns}
        data={visible}
        loading={loading}
        error={allFailed ? extractApiError(sales.error ?? purchases.error ?? closings.error).message : null}
        emptyTitle="لا توجد إيصالات مطابقة"
        emptyDescription="جرّب تغيير الفلاتر أو نطاق التاريخ"
      />

      {filtered.length > visible.length && (
        <div className="flex justify-center mt-4">
          <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE)} className="h-10 px-4 rounded-lg border border-input bg-background text-sm hover:bg-accent">
            عرض المزيد ({filtered.length - visible.length} متبقية)
          </button>
        </div>
      )}

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${KIND_META[viewing.kind].label} - ${viewing.number}` : ''}
        maxWidth="max-w-2xl"
      >
        {viewing && (viewing.kind === 'CASH_CLOSING'
          ? <CashClosingDetails closing={viewing.source as CashClosingResponse} />
          : viewing.kind === 'SALE'
          ? <SalesInvoiceDetails invoice={viewing.source as SalesInvoice} />
          : viewing.kind === 'RETURN'
          ? <ReturnDetails ret={viewing.source as SalesReturn} />
          : viewing.kind === 'PAYMENT'
          ? <PaymentDetails payment={viewing.source as CustomerPayment} />
          : <InvoiceDetails row={viewing} />)}
      </Modal>
    </div>
  );
}

function InvoiceDetails({ row }: { row: ReceiptRow }) {
  const inv = row.source as SalesInvoice | PurchaseInvoice;
  const isSale = row.kind === 'SALE';
  const sale = isSale ? (inv as SalesInvoice) : null;
  return (
    <div className="space-y-4">
      <ClosedBranchBadge branchId={row.branchId} branchName={row.branchName} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">{isSale ? 'العميل' : 'الطرف'}</p>
          <p className="text-sm font-medium">{row.party}</p>
          {sale?.customer?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{sale.customer.phone}</p>}
        </div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">{isSale ? 'الكاشير' : 'التاريخ'}</p><p className="text-sm font-medium">{isSale ? sale?.cashierName ?? '-' : row.dateLabel}</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">طريقة الدفع</p>{row.paymentMethod ? <Badge variant="info">{getPaymentMethodLabel(row.paymentMethod)}</Badge> : '-'}</div>
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
      <p className="text-xs text-muted-foreground">التاريخ: {row.dateLabel}</p>
      {inv.notes && <div><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-sm">{inv.notes}</p></div>}
    </div>
  );
}

function CashClosingDetails({ closing }: { closing: CashClosingResponse }) {
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
            {DENOMS.map((d) => (
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

function ReturnDetails({ ret }: { ret: SalesReturn }) {
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

function PaymentDetails({ payment }: { payment: CustomerPayment }) {
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

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
import { PurchaseInvoiceDetails, CashClosingDetails, ReturnDetails, PaymentDetails } from '@/components/receipts/ReceiptDetails';
import { round2 } from '@/utils/pricing';
import { useDateRange } from '@/hooks/useDateRange';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { formatCurrency, formatDate } from '@/utils/format';
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


export default function ReceiptsPage() {
  const { user, isAdmin } = useAuth();
  const ownBranchId = user?.branchId ?? undefined;

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<Kind | 'ALL'>('ALL');
  // Loaded per period from the server (this month by default).
  const range = useDateRange();
  const fromDate = range.from;
  const toDate = range.to;
  const params = { from: fromDate, to: toDate };
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [viewing, setViewing] = useState<ReceiptRow | null>(null);


  // The backend already scopes sales invoices to an employee's branch.
  const sales = useQuery({ queryKey: ['sales-invoices', params], queryFn: () => salesInvoicesService.getAll(params) });
  // Purchase invoices are ADMIN-only end to end.
  const purchases = useQuery({ queryKey: ['purchase-invoices', params], queryFn: () => purchaseInvoicesService.getAll(params), enabled: isAdmin });
  // GET /api/cash-closings is ADMIN-only; employees read their own branch.
  const returnsQ = useQuery({ queryKey: ['sales-returns', params], queryFn: () => salesReturnsService.getAll(params) });
  const paymentsQ = useQuery({ queryKey: ['customer-payments', params], queryFn: () => customerAccountsService.getAllPayments(params) });
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
          <DateRangeFilter
            from={fromDate}
            to={toDate}
            onFrom={(v) => { range.setFrom(v); resetPaging(); }}
            onTo={(v) => { range.setTo(v); resetPaging(); }}
            onReset={() => { range.reset(); setSearch(''); resetPaging(); }}
            showReset={!range.isDefault || !!search}
            idPrefix="receipts"
          />
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
          : <PurchaseInvoiceDetails invoice={viewing.source as PurchaseInvoice} />)}
      </Modal>
    </div>
  );
}

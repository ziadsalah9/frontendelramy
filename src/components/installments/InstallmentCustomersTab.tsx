import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, MessageCircle, Wallet } from 'lucide-react';
import { installmentsService } from '@/api/installments';
import { extractApiError } from '@/api/client';
import type { InstallmentCustomer } from '@/types';
import { DataTable, SearchInput, Badge, type Column } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { CustomerAccountPanel } from '@/components/customers/CustomerAccountPanel';
import { InstallmentPlanView } from '@/components/sales/InstallmentSchedule';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { formatCurrency } from '@/utils/format';
import { matches } from '@/utils/validation';
import { whatsappLink } from '@/utils/whatsapp';

type Filter = 'all' | 'late' | 'paying' | 'done';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'late', label: 'متأخرون' },
  { value: 'paying', label: 'منتظمون' },
  { value: 'done', label: 'انتهوا' },
];

const stateOf = (c: InstallmentCustomer): Exclude<Filter, 'all'> => (c.overdueCount > 0 ? 'late' : c.remaining > 0 ? 'paying' : 'done');

function Progress({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="min-w-[7rem]">
      <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة السداد">
        <div className={`h-full ${pct === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">سُدد {pct}% · {formatCurrency(paid)} من {formatCurrency(total)}</p>
    </div>
  );
}

/** Customers who bought on installments: who is late, who is paying, who finished, with each customer's plans. */
export function InstallmentCustomersTab() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<InstallmentCustomer | null>(null);
  const [collectFor, setCollectFor] = useState<InstallmentCustomer | null>(null);
  const settings = useStoreSettings();
  const { data, isLoading, error } = useQuery({ queryKey: ['installment-customers'], queryFn: installmentsService.customers });

  const all = data ?? [];
  const rows = all.filter((c) => (filter === 'all' || stateOf(c) === filter) && (matches(c.customerName, search) || matches(c.customerPhone ?? '', search)));
  const owed = all.reduce((s, c) => s + c.remaining, 0);
  const overdue = all.reduce((s, c) => s + c.overdueAmount, 0);
  const lateCount = all.filter((c) => c.overdueCount > 0).length;
  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((c) => stateOf(c) === f).length);

  const reminder = (c: InstallmentCustomer) =>
    `السلام عليكم ${c.customerName}، نذكّركم بأقساط مستحقة بقيمة ${formatCurrency(c.overdueCount > 0 ? c.overdueAmount : c.nextDueAmount ?? 0)} جنيه`
    + (c.overdueCount > 0 ? ` (متأخرة منذ ${c.maxDaysLate} يوم).` : c.nextDueDate ? ` تستحق يوم ${c.nextDueDate}.` : '.')
    + (settings.data?.storeName ? ` - ${settings.data.storeName}` : '');

  const columns: Column<InstallmentCustomer & { id: number }>[] = [
    { key: 'customer', header: 'العميل', render: (c) => <div><p className="font-medium">{c.customerName}</p><p className="text-xs text-muted-foreground" dir="ltr">{c.customerPhone}</p></div> },
    { key: 'plans', header: 'الخطط', render: (c) => <span className="whitespace-nowrap">{c.openPlans} مفتوحة{c.plans > c.openPlans && <span className="text-muted-foreground"> / {c.plans}</span>}</span> },
    { key: 'progress', header: 'السداد', render: (c) => <Progress paid={c.paid} total={c.totalAmount} /> },
    { key: 'remaining', header: 'المتبقي', render: (c) => <span className={`font-bold whitespace-nowrap ${c.remaining > 0 ? '' : 'text-success'}`}>{formatCurrency(c.remaining)} ج.م</span> },
    {
      key: 'state', header: 'الحالة',
      render: (c) => c.overdueCount > 0
        ? <div><Badge variant="destructive">متأخر {c.maxDaysLate} يوم</Badge><p className="mt-1 text-[11px] text-destructive whitespace-nowrap">{c.overdueCount} قسط · {formatCurrency(c.overdueAmount)} ج.م</p></div>
        : c.remaining > 0 ? <Badge variant="info">منتظم</Badge> : <Badge variant="success">انتهى</Badge>,
    },
    {
      key: 'next', header: 'القسط القادم',
      render: (c) => c.nextDueDate
        ? <div className="whitespace-nowrap"><p dir="ltr" className="text-sm text-right">{c.nextDueDate}</p><p className="text-xs text-muted-foreground">{formatCurrency(c.nextDueAmount ?? 0)} ج.م</p></div>
        : <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'actions', header: '', className: 'text-left w-px',
      render: (c) => {
        const wa = c.remaining > 0 ? whatsappLink(c.customerPhone, reminder(c)) : null;
        return (
          <div className="flex gap-1 justify-end">
            <button type="button" onClick={() => setViewing(c)} className="flex items-center gap-1 h-8 px-2 rounded-lg border text-xs hover:bg-accent">
              <Eye className="w-4 h-4" /> التفاصيل
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" title="تذكير واتساب" aria-label={`تذكير ${c.customerName} على واتساب`}
                className="flex items-center h-8 px-2 rounded-lg border text-success hover:bg-success/10"><MessageCircle className="w-4 h-4" /></a>
            )}
            {c.remaining > 0 && (
              <button type="button" onClick={() => setCollectFor(c)} className="flex items-center gap-1 h-8 px-2 rounded-lg border text-primary text-xs hover:bg-primary/10">
                <Wallet className="w-4 h-4" /> تحصيل
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const chipCls = (on: boolean) => `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-card hover:bg-accent'}`;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">عملاء التقسيط</p><p className="text-xl font-bold">{all.length}</p><p className="text-xs text-muted-foreground">{all.filter((c) => c.remaining > 0).length} ما زالوا يسددون</p></div>
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">إجمالي المتبقي</p><p className="text-xl font-bold">{formatCurrency(owed)} ج.م</p></div>
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">متأخر</p><p className="text-xl font-bold text-destructive">{formatCurrency(overdue)} ج.م</p><p className="text-xs text-muted-foreground">{lateCount} عميل</p></div>
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">نسبة التحصيل</p><p className="text-xl font-bold text-success">{(() => { const t = all.reduce((s, c) => s + c.totalAmount, 0); return t > 0 ? Math.round((all.reduce((s, c) => s + c.paid, 0) / t) * 100) : 0; })()}%</p><p className="text-xs text-muted-foreground">من إجمالي الأقساط</p></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)} className={chipCls(filter === f.value)}>
              {f.label} <span className="opacity-70">({count(f.value)})</span>
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الهاتف..." />
      </div>

      <DataTable columns={columns} data={rows.map((c) => ({ ...c, id: c.customerId }))} loading={isLoading}
        error={error ? extractApiError(error).message : null}
        emptyTitle={all.length === 0 ? 'لا يوجد عملاء تقسيط' : 'لا يوجد عملاء بهذا الفلتر'} emptyDescription="خطط التقسيط تُنشأ عند البيع بالتقسيط" />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `أقساط ${viewing.customerName}` : ''} maxWidth="max-w-3xl">
        {viewing && <CustomerPlans customer={viewing} onCollect={() => { setCollectFor(viewing); setViewing(null); }} />}
      </Modal>
      <Modal open={!!collectFor} onClose={() => setCollectFor(null)} title={`تحصيل من ${collectFor?.customerName ?? ''}`} maxWidth="max-w-2xl">
        {collectFor && <CustomerAccountPanel customerId={collectFor.customerId} />}
      </Modal>
    </>
  );
}

/** Every plan of one customer, newest first, with its schedule. */
function CustomerPlans({ customer, onCollect }: { customer: InstallmentCustomer; onCollect: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['installment-customer', customer.customerId],
    queryFn: () => installmentsService.forCustomer(customer.customerId),
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">إجمالي الأقساط</p><p className="font-bold">{formatCurrency(customer.totalAmount)} ج.م</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">المدفوع</p><p className="font-bold text-success">{formatCurrency(customer.paid)} ج.م</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">المتبقي</p><p className="font-bold">{formatCurrency(customer.remaining)} ج.م</p></div>
        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">متأخر</p><p className={`font-bold ${customer.overdueAmount > 0 ? 'text-destructive' : ''}`}>{formatCurrency(customer.overdueAmount)} ج.م</p></div>
      </div>
      {customer.remaining > 0 && (
        <button type="button" onClick={onCollect} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
          <Wallet className="w-4 h-4" /> تحصيل دفعة
        </button>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        : error ? <p className="text-sm text-destructive">{extractApiError(error).message}</p>
        : (data ?? []).map((plan) => (
          <div key={plan.id} className="p-3 rounded-lg border">
            <InstallmentPlanView plan={plan} title={`فاتورة ${plan.invoiceNumber}`} />
          </div>
        ))}
    </div>
  );
}

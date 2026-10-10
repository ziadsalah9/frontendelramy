import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Wallet } from 'lucide-react';
import { installmentsService } from '@/api/installments';
import { extractApiError } from '@/api/client';
import type { DueInstallment } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, Badge, type Column } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { CustomerAccountPanel } from '@/components/customers/CustomerAccountPanel';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { formatCurrency } from '@/utils/format';
import { matches } from '@/utils/validation';
import { whatsappLink } from '@/utils/whatsapp';
import { InstallmentCustomersTab } from '@/components/installments/InstallmentCustomersTab';

const WINDOWS = [
  { days: 0, label: 'المتأخرة' },
  { days: 7, label: 'خلال أسبوع' },
  { days: 30, label: 'خلال شهر' },
];

type View = 'due' | 'customers';

/** Installments: the follow-up list (overdue / coming) and the customers with their plans. */
export default function InstallmentsPage() {
  const [view, setView] = useState<View>('due');
  const tabCls = (on: boolean) => `px-4 py-2 rounded-md text-sm font-medium transition-all ${on ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`;
  return (
    <div>
      <PageHeader title="الأقساط" description="متابعة الأقساط المتأخرة والقادمة، وعملاء التقسيط وتفاصيل خططهم" />
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4" role="tablist" aria-label="عرض الأقساط">
        <button type="button" role="tab" aria-selected={view === 'due'} onClick={() => setView('due')} className={tabCls(view === 'due')}>المتابعة</button>
        <button type="button" role="tab" aria-selected={view === 'customers'} onClick={() => setView('customers')} className={tabCls(view === 'customers')}>العملاء</button>
      </div>
      {view === 'due' ? <DueInstallmentsTab /> : <InstallmentCustomersTab />}
    </div>
  );
}

/** Overdue and coming installments, with a WhatsApp reminder and quick collection. */
function DueInstallmentsTab() {
  const [days, setDays] = useState(0);
  const [search, setSearch] = useState('');
  const [collectFor, setCollectFor] = useState<DueInstallment | null>(null);
  const settings = useStoreSettings();
  const { data, isLoading, error } = useQuery({ queryKey: ['installments-due', days], queryFn: () => installmentsService.due(days) });

  const rows = (data ?? []).filter((r) => matches(r.customerName, search) || matches(r.customerPhone, search) || matches(r.invoiceNumber, search));
  const overdue = rows.filter((r) => r.daysLate > 0);
  const overdueTotal = overdue.reduce((s, r) => s + r.remaining, 0);
  const total = rows.reduce((s, r) => s + r.remaining, 0);

  const reminder = (r: DueInstallment) =>
    `السلام عليكم ${r.customerName}، نذكّركم بقسط رقم ${r.seq} من ${r.months} لفاتورة ${r.invoiceNumber} بقيمة ${formatCurrency(r.remaining)} جنيه`
    + (r.daysLate > 0 ? ` (مستحق منذ ${r.dueDate}).` : ` مستحق يوم ${r.dueDate}.`)
    + (settings.data?.storeName ? ` - ${settings.data.storeName}` : '');

  const columns: Column<DueInstallment>[] = [
    { key: 'customer', header: 'العميل', render: (r) => <div><p className="font-medium">{r.customerName}</p><p className="text-xs text-muted-foreground" dir="ltr">{r.customerPhone}</p></div> },
    { key: 'invoice', header: 'الفاتورة', render: (r) => <span className="font-mono text-sm" dir="ltr">{r.invoiceNumber}</span> },
    { key: 'seq', header: 'القسط', render: (r) => `${r.seq} من ${r.months}` },
    { key: 'due', header: 'الاستحقاق', render: (r) => <span dir="ltr" className="whitespace-nowrap">{r.dueDate}</span> },
    { key: 'amount', header: 'المتبقي', render: (r) => <span className="font-bold whitespace-nowrap">{formatCurrency(r.remaining)} ج.م</span> },
    {
      key: 'late', header: 'الحالة',
      render: (r) => r.daysLate > 0 ? <Badge variant="destructive">متأخر {r.daysLate} يوم</Badge> : <Badge variant="info">قادم</Badge>,
    },
    {
      key: 'actions', header: '', className: 'text-left w-px',
      render: (r) => {
        const wa = whatsappLink(r.customerPhone, reminder(r));
        return (
          <div className="flex gap-1 justify-end">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" title="تذكير واتساب"
                className="flex items-center gap-1 h-8 px-2 rounded-lg border text-success text-xs hover:bg-success/10">
                <MessageCircle className="w-4 h-4" /> واتساب
              </a>
            )}
            <button type="button" onClick={() => setCollectFor(r)} className="flex items-center gap-1 h-8 px-2 rounded-lg border text-primary text-xs hover:bg-primary/10">
              <Wallet className="w-4 h-4" /> تحصيل
            </button>
          </div>
        );
      },
    },
  ];

  const tabCls = (on: boolean) => `px-3 py-1.5 rounded-md text-sm font-medium transition-all ${on ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">متأخر</p><p className="text-xl font-bold text-destructive">{formatCurrency(overdueTotal)} ج.م</p><p className="text-xs text-muted-foreground">{overdue.length} قسط</p></div>
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">إجمالي المعروض</p><p className="text-xl font-bold">{formatCurrency(total)} ج.م</p><p className="text-xs text-muted-foreground">{rows.length} قسط</p></div>
      </div>
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-4">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" role="tablist">
          {WINDOWS.map((w) => (
            <button key={w.days} type="button" role="tab" aria-selected={days === w.days} onClick={() => setDays(w.days)} className={tabCls(days === w.days)}>{w.label}</button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالعميل أو الهاتف أو الفاتورة..." />
      </div>
      <DataTable columns={columns} data={rows.map((r) => ({ ...r, id: r.installmentId }))} loading={isLoading}
        error={error ? extractApiError(error).message : null}
        emptyTitle={days === 0 ? 'لا توجد أقساط متأخرة' : 'لا توجد أقساط مستحقة في هذه الفترة'} emptyDescription="الأقساط تُنشأ عند البيع بالتقسيط" />

      <Modal open={!!collectFor} onClose={() => setCollectFor(null)} title={`تحصيل من ${collectFor?.customerName ?? ''}`} maxWidth="max-w-2xl">
        {collectFor && <CustomerAccountPanel customerId={collectFor.customerId} />}
      </Modal>
    </>
  );
}

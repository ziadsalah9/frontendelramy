import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import { salesInvoicesService } from '@/api/salesInvoices';
import type { SalesInvoice } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { formatDate, formatCurrency, getPaymentMethodLabel } from '@/utils/format';
import { matches } from '@/utils/validation';
import { extractApiError } from '@/api/client';
import { SalesInvoiceDetails } from '@/components/sales/SalesInvoiceDetails';
import { NewSalesInvoiceDialog } from '@/components/sales/NewSalesInvoiceDialog';
import { useDateRange } from '@/hooks/useDateRange';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';

export default function SalesInvoicesPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  // "بيع جديد" / F2 from any page lands here with ?new=1.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      setModalOpen(true);
      setParams((p) => { p.delete('new'); return p; }, { replace: true });
    }
  }, [params, setParams]);
  const [viewing, setViewing] = useState<SalesInvoice | null>(null);

  // One period at a time (this month by default) instead of all history.
  const range = useDateRange();
  const { data: invoices, isLoading, error: queryError } = useQuery({ queryKey: ['sales-invoices', { from: range.from, to: range.to }], queryFn: () => salesInvoicesService.getAll({ from: range.from, to: range.to }) });

  const filtered = (invoices ?? []).filter(
    (inv) =>
      matches(inv.invoiceNumber, search) ||
      matches(inv.customer?.name, search) ||
      matches(inv.customer?.phone, search),
  );

  const openCreate = () => setModalOpen(true);

  const columns: Column<SalesInvoice>[] = [
    { key: 'invoiceNumber', header: 'رقم الفاتورة', render: (inv) => <span className="font-mono text-sm font-medium" dir="ltr">{inv.invoiceNumber}</span> },
    { key: 'customer', header: 'العميل', render: (inv) => <span className="font-medium">{inv.customer?.name ?? '-'}</span> },
    { key: 'cashier', header: 'الكاشير', render: (inv) => inv.cashierName ?? '-' },
    { key: 'total', header: 'الإجمالي', render: (inv) => <span className="font-bold">{formatCurrency(inv.total)} ج.م</span> },
    { key: 'paid', header: 'المدفوع', render: (inv) => <span className="text-success font-medium">{formatCurrency(inv.paid)} ج.م</span> },
    { key: 'remaining', header: 'المتبقي', render: (inv) => <span className={inv.remaining && inv.remaining > 0 ? 'text-destructive font-medium' : ''}>{formatCurrency(inv.remaining)} ج.م</span> },
    { key: 'paymentMethod', header: 'الدفع', render: (inv) => <Badge variant="info">{getPaymentMethodLabel(inv.paymentMethod)}</Badge> },
    { key: 'createdAt', header: 'التاريخ', render: (inv) => <span className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</span> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (inv) => <ActionButton onClick={() => setViewing(inv)} icon={Eye} label="عرض" />,
    },
  ];

  return (
    <div>
      <PageHeader title="فواتير البيع" description="إدارة فواتير البيع للعملاء" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> فاتورة بيع جديدة
        </button>
      } />

      <div className="mb-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث برقم الفاتورة أو اسم العميل أو الهاتف..." />
        <DateRangeFilter from={range.from} to={range.to} onFrom={range.setFrom} onTo={range.setTo} onReset={range.reset} showReset={!range.isDefault} idPrefix="sales" />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={setViewing}
        rowLabel={(i) => `فتح الفاتورة ${i.invoiceNumber}`}
        loading={isLoading}
        error={queryError ? extractApiError(queryError).message : null}
        emptyTitle={search ? 'لا توجد نتائج مطابقة' : 'لا توجد فواتير بيع'}
        emptyDescription={search ? 'جرّب كلمة بحث أخرى' : 'ابدأ بإنشاء فاتورة بيع جديدة'}
      />

      <NewSalesInvoiceDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(invoice) => { setModalOpen(false); setViewing(invoice); }}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`فاتورة بيع - ${viewing?.invoiceNumber ?? ''}`} maxWidth="max-w-2xl">
        {viewing && <SalesInvoiceDetails invoice={viewing} />}
      </Modal>
    </div>
  );
}
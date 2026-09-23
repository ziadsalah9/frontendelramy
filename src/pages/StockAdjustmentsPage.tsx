import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, SlidersHorizontal } from 'lucide-react';
import { stockAdjustmentsService } from '@/api/stockAdjustments';
import { branchesService } from '@/api/branches';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { StockAdjustment } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { formatDate } from '@/utils/format';
import { toast } from 'sonner';

export default function StockAdjustmentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<StockAdjustment | null>(null);
  const [form, setForm] = useState({ branchId: '', productId: '', quantity: '', reason: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: adjustments, isLoading, error: queryError } = useQuery({ queryKey: ['stock-adjustments'], queryFn: stockAdjustmentsService.getAll });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const filtered = (adjustments ?? []).filter((a) => (a.reason ?? '').includes(search) || (a.notes ?? '').includes(search));

  const openCreate = () => {
    setForm({ branchId: '', productId: '', quantity: '', reason: '', notes: '' });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await stockAdjustmentsService.create({
        branchId: Number(form.branchId),
        productId: Number(form.productId),
        quantity: Number(form.quantity),
        reason: form.reason,
        notes: form.notes || undefined,
      });
      toast.success('تم إنشاء تعديل المخزون بنجاح');
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<StockAdjustment>[] = [
    { key: 'id', header: 'رقم', render: (a) => <span className="font-mono">#{a.id}</span> },
    { key: 'branch', header: 'الفرع', render: (a) => {
      const branch = branches?.find((b) => b.id === a.branchId);
      return branch?.name ?? `#${a.branchId}`;
    }},
    { key: 'product', header: 'المنتج', render: (a) => {
      const product = products?.find((p) => p.id === a.productId);
      return <span className="font-medium">{product?.name ?? `#${a.productId}`}</span>;
    }},
    { key: 'quantity', header: 'الكمية', render: (a) => <Badge variant={a.quantity >= 0 ? 'success' : 'destructive'}>{a.quantity > 0 ? '+' : ''}{a.quantity}</Badge> },
    { key: 'reason', header: 'السبب', render: (a) => a.reason ?? '-' },
    { key: 'createdAt', header: 'التاريخ', render: (a) => <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (a) => <ActionButton onClick={() => setViewing(a)} icon={Eye} label="عرض" />,
    },
  ];

  return (
    <div>
      <PageHeader title="تعديلات المخزون" description="تسجيل وعرض تعديلات المخزون" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> تعديل مخزون
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث بالسبب أو الملاحظات..." /></div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا توجد تعديلات" emptyDescription="ابدأ بإنشاء تعديل مخزون جديد" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="تعديل مخزون جديد">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect label="الفرع" value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} required placeholder="اختر الفرع" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
          <FormSelect label="المنتج" value={form.productId} onChange={(v) => setForm({ ...form, productId: v })} required placeholder="اختر المنتج" options={(products ?? []).map((p) => ({ value: p.id, label: `${p.name} - ${p.type ?? ''} ${p.color ?? ''}` }))} />
          <FormInput label="الكمية (موجب للزيادة، سالب للنقص)" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} required placeholder="مثال: 5 أو -3" dir="ltr" />
          <FormInput label="السبب" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} required placeholder="سبب التعديل" />
          <FormTextarea label="ملاحظات" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="ملاحظات إضافية" />
          <SubmitButton loading={loading} label="إنشاء التعديل" />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="تفاصيل التعديل">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الفرع</p><p className="text-sm font-medium">{branches?.find((b) => b.id === viewing.branchId)?.name ?? `#${viewing.branchId}`}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">المنتج</p><p className="text-sm font-medium">{products?.find((p) => p.id === viewing.productId)?.name ?? `#${viewing.productId}`}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الكمية</p><Badge variant={viewing.quantity >= 0 ? 'success' : 'destructive'}>{viewing.quantity > 0 ? '+' : ''}{viewing.quantity}</Badge></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">التاريخ</p><p className="text-sm font-medium">{formatDate(viewing.createdAt)}</p></div>
            </div>
            <div><p className="text-xs text-muted-foreground mb-1">السبب</p><p className="text-sm">{viewing.reason}</p></div>
            {viewing.notes && <div><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-sm">{viewing.notes}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

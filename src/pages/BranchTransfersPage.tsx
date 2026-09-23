import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, ArrowLeftRight, X, Trash2 } from 'lucide-react';
import { branchTransfersService } from '@/api/branchTransfers';
import { branchesService } from '@/api/branches';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { BranchTransfer } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormSelect, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { formatDate, getTransferStatusLabel } from '@/utils/format';
import { toast } from 'sonner';

export default function BranchTransfersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<BranchTransfer | null>(null);
  const [form, setForm] = useState({ fromBranchId: '', toBranchId: '', notes: '', items: [{ productId: '', quantity: '' }] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: transfers, isLoading, error: queryError } = useQuery({ queryKey: ['branch-transfers'], queryFn: branchTransfersService.getAll });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const filtered = (transfers ?? []).filter((t) => (t.notes ?? '').includes(search) || (t.transferNumber ?? '').includes(search));

  const openCreate = () => {
    setForm({ fromBranchId: '', toBranchId: '', notes: '', items: [{ productId: '', quantity: '' }] });
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: '', quantity: '' }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  const updateItem = (idx: number, field: 'productId' | 'quantity', value: string) => {
    const items = form.items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setForm({ ...form, items });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.fromBranchId === form.toBranchId) { setError('لا يمكن التحويل من فرع إلى نفسه'); return; }
    setLoading(true);
    setError('');
    try {
      await branchTransfersService.create({
        fromBranchId: Number(form.fromBranchId),
        toBranchId: Number(form.toBranchId),
        notes: form.notes || undefined,
        items: form.items.filter((i) => i.productId && i.quantity).map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity) })),
      });
      toast.success('تم إنشاء التحويل بنجاح');
      queryClient.invalidateQueries({ queryKey: ['branch-transfers'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<BranchTransfer>[] = [
    { key: 'id', header: 'رقم', render: (t) => <span className="font-mono">#{t.id}</span> },
    { key: 'fromBranch', header: 'من فرع', render: (t) => branches?.find((b) => b.id === t.fromBranchId)?.name ?? `#${t.fromBranchId}` },
    { key: 'toBranch', header: 'إلى فرع', render: (t) => branches?.find((b) => b.id === t.toBranchId)?.name ?? `#${t.toBranchId}` },
    { key: 'items', header: 'المنتجات', render: (t) => <span className="text-sm">{t.items?.length ?? 0} منتج</span> },
    { key: 'status', header: 'الحالة', render: (t) => <Badge variant={t.status === 'COMPLETED' ? 'success' : t.status === 'PENDING' ? 'warning' : 'destructive'}>{getTransferStatusLabel(t.status)}</Badge> },
    { key: 'createdAt', header: 'التاريخ', render: (t) => <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (t) => <ActionButton onClick={() => setViewing(t)} icon={Eye} label="عرض" />,
    },
  ];

  return (
    <div>
      <PageHeader title="التحويلات بين الفروع" description="تحويل المنتجات بين الفروع" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> تحويل جديد
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث برقم التحويل أو الملاحظات..." /></div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا توجد تحويلات" emptyDescription="ابدأ بإنشاء تحويل جديد" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="تحويل جديد بين الفروع" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormSelect label="من فرع" value={form.fromBranchId} onChange={(v) => setForm({ ...form, fromBranchId: v })} required placeholder="اختر الفرع المصدر" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
            <FormSelect label="إلى فرع" value={form.toBranchId} onChange={(v) => setForm({ ...form, toBranchId: v })} required placeholder="اختر الفرع المستلم" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">المنتجات</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="w-4 h-4" /> إضافة منتج</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} required className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none">
                    <option value="">اختر منتج</option>
                    {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} - {p.itemType ?? ''} {p.color ?? ''}</option>)}
                  </select>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} required placeholder="الكمية" className="w-28 h-10 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none" dir="ltr" />
                  {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2.5 rounded-lg text-destructive hover:bg-destructive/10"><X className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
          </div>

          <FormTextarea label="ملاحظات" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="ملاحظات التحويل" />
          <SubmitButton loading={loading} label="إنشاء التحويل" />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`تفاصيل التحويل #${viewing?.id ?? ''}`} maxWidth="max-w-2xl">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">من فرع</p><p className="text-sm font-medium">{branches?.find((b) => b.id === viewing.fromBranchId)?.name ?? `#${viewing.fromBranchId}`}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">إلى فرع</p><p className="text-sm font-medium">{branches?.find((b) => b.id === viewing.toBranchId)?.name ?? `#${viewing.toBranchId}`}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الحالة</p><Badge variant={viewing.status === 'COMPLETED' ? 'success' : viewing.status === 'PENDING' ? 'warning' : 'destructive'}>{getTransferStatusLabel(viewing.status)}</Badge></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">التاريخ</p><p className="text-sm font-medium">{formatDate(viewing.createdAt)}</p></div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">المنتجات</h4>
              <div className="space-y-2">
                {viewing.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm font-medium">{products?.find((p) => p.id === item.productId)?.name ?? `#${item.productId}`}</span>
                    <Badge variant="info">{item.quantity} وحدة</Badge>
                  </div>
                ))}
              </div>
            </div>
            {viewing.notes && <div><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-sm">{viewing.notes}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

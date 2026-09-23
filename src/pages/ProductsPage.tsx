import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Eye, Trash2, Package } from 'lucide-react';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { Product, ProductType } from '@/types';
import { PRODUCT_TYPES, PRODUCT_COLORS, PRODUCT_SIZES } from '@/types';
import { PageHeader, ConfirmDialog } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, SubmitButton } from '@/components/shared/Modal';
import { toast } from 'sonner';

interface ProductForm {
  name: string;
  type: ProductType | '';
  color: string;
  size: string;
  model: string;
  minimumQuantity: string;
}

const emptyForm: ProductForm = {
  name: '',
  type: '',
  color: '',
  size: '',
  model: '',
  minimumQuantity: '0',
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: products, isLoading, error: queryError } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const filtered = (products ?? []).filter((p) =>
    p.name.includes(search) ||
    (p.code ?? '').includes(search) ||
    (p.barcode ?? '').includes(search) ||
    (p.model ?? '').includes(search) ||
    (p.itemType ?? '').includes(search) ||
    (p.color ?? '').includes(search)
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.itemType ?? '',
      color: p.color ?? '',
      size: p.size ?? '',
      model: p.model ?? '',
      minimumQuantity: String(p.minimumQuantity),
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        itemType: form.type as ProductType,
        color: form.color,
        size: form.size,
        model: form.model || undefined,
        minimumQuantity: Number(form.minimumQuantity),
      };
      if (editing) {
        await productsService.update(editing.id, payload);
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        await productsService.create(payload);
        toast.success('تم إضافة المنتج بنجاح');
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productsService.delete(deleteTarget.id);
      toast.success('تم حذف المنتج بنجاح');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns: Column<Product>[] = [
    { key: 'name', header: 'الاسم', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'type', header: 'النوع', render: (p) => p.itemType ? <Badge variant="info">{p.itemType}</Badge> : '-' },
    { key: 'color', header: 'اللون', render: (p) => p.color ?? '-' },
    { key: 'size', header: 'المقاس', render: (p) => p.size ?? '-' },
    { key: 'model', header: 'الموديل', render: (p) => p.model ?? '-' },
    { key: 'minimumQuantity', header: 'الحد الأدنى', render: (p) => <Badge variant={p.minimumQuantity > 0 ? 'info' : 'default'}>{p.minimumQuantity}</Badge> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (p) => (
        <div className="flex items-center gap-1">
          <ActionButton onClick={() => setViewing(p)} icon={Eye} label="عرض" />
          <ActionButton onClick={() => openEdit(p)} icon={Edit2} label="تعديل" />
          <ActionButton onClick={() => setDeleteTarget(p)} icon={Trash2} label="حذف" variant="destructive" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="المنتجات" description="إدارة منتجات المتجر" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> إضافة منتج
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو النوع أو اللون..." /></div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا توجد منتجات" emptyDescription="ابدأ بإضافة منتج جديد" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل منتج' : 'إضافة منتج جديد'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="اسم المنتج" />
          <FormSelect
            label="النوع"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v as ProductType })}
            options={PRODUCT_TYPES}
            required
            placeholder="اختر النوع"
          />
          <FormSelect
            label="اللون"
            value={form.color}
            onChange={(v) => setForm({ ...form, color: v })}
            options={PRODUCT_COLORS}
            required
            placeholder="اختر اللون"
          />
          <FormSelect
            label="المقاس"
            value={form.size}
            onChange={(v) => setForm({ ...form, size: v })}
            options={PRODUCT_SIZES}
            required
            placeholder="اختر المقاس"
          />
          <FormInput label="الموديل" value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="موديل المنتج (اختياري)" />
          <FormInput label="الحد الأدنى للكمية" type="number" value={form.minimumQuantity} onChange={(v) => setForm({ ...form, minimumQuantity: v })} required />
          <SubmitButton loading={loading} label={editing ? 'حفظ التغييرات' : 'إضافة'} />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="تفاصيل المنتج">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="w-6 h-6 text-primary" /></div>
              <div><p className="font-bold text-foreground">{viewing.name}</p><p className="text-sm text-muted-foreground">{viewing.itemType}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">النوع</p><p className="text-sm font-medium">{viewing.itemType ?? '-'}</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">اللون</p><p className="text-sm font-medium">{viewing.color ?? '-'}</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المقاس</p><p className="text-sm font-medium">{viewing.size ?? '-'}</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">الموديل</p><p className="text-sm font-medium">{viewing.model ?? '-'}</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">الحد الأدنى</p><p className="text-sm font-medium">{viewing.minimumQuantity}</p></div>
              {viewing.code && <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">الكود</p><p className="text-sm font-medium font-mono">{viewing.code}</p></div>}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} title="حذف المنتج" description={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`} confirmText="حذف" destructive />
    </div>
  );
}
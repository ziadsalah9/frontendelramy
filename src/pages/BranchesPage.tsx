import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Eye, Phone, MapPin, Building2 } from 'lucide-react';
import { branchesService } from '@/api/branches';
import { extractApiError } from '@/api/client';
import type { Branch } from '@/types';
import { PageHeader, ConfirmDialog } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, SubmitButton } from '@/components/shared/Modal';
import { toast } from 'sonner';

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [viewing, setViewing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);

  const { data: branches, isLoading, error: queryError } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });

  const filtered = (branches ?? []).filter((b) => b.name.includes(search) || (b.address ?? '').includes(search) || (b.phone ?? '').includes(search));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '' });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await branchesService.update(editing.id, form);
        toast.success('تم تحديث الفرع بنجاح');
      } else {
        await branchesService.create(form);
        toast.success('تم إضافة الفرع بنجاح');
      }
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Branch>[] = [
    { key: 'name', header: 'الاسم', render: (b) => <span className="font-medium">{b.name}</span> },
    { key: 'address', header: 'العنوان', render: (b) => b.address ?? '-' },
    { key: 'phone', header: 'الهاتف', render: (b) => b.phone ?? '-' },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (b) => (
        <div className="flex items-center gap-1">
          <ActionButton onClick={() => setViewing(b)} icon={Eye} label="عرض" />
          <ActionButton onClick={() => openEdit(b)} icon={Edit2} label="تعديل" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="الفروع" description="إدارة فروع المتجر" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> إضافة فرع
        </button>
      } />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو العنوان أو الهاتف..." />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا توجد فروع" emptyDescription="ابدأ بإضافة فرع جديد" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل فرع' : 'إضافة فرع جديد'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="اسم الفرع" error={error} />
          <FormInput label="العنوان" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="عنوان الفرع" />
          <FormInput label="الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="رقم الهاتف" dir="ltr" />
          <SubmitButton loading={loading} label={editing ? 'حفظ التغييرات' : 'إضافة'} />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="تفاصيل الفرع">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="w-6 h-6 text-primary" /></div>
              <div><p className="font-bold text-foreground">{viewing.name}</p><p className="text-sm text-muted-foreground">فرع</p></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{viewing.address ?? 'غير محدد'}</span></div>
              <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-muted-foreground" /><span className="text-sm ltr text-left" dir="ltr">{viewing.phone ?? 'غير محدد'}</span></div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onConfirm={() => setConfirmDelete(null)} onCancel={() => setConfirmDelete(null)} title="حذف الفرع" description="هل أنت متأكد من حذف هذا الفرع؟" confirmText="حذف" destructive />
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Eye, Phone, MapPin, User } from 'lucide-react';
import { customersService } from '@/api/customers';
import { extractApiError } from '@/api/client';
import type { Customer } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { toast } from 'sonner';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: customers, isLoading, error: queryError } = useQuery({ queryKey: ['customers'], queryFn: customersService.getAll });

  const filtered = (customers ?? []).filter((c) => c.name.includes(search) || c.phone.includes(search));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', address: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address ?? '' });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await customersService.update(editing.id, form);
        toast.success('تم تحديث العميل بنجاح');
      } else {
        await customersService.create(form);
        toast.success('تم إضافة العميل بنجاح');
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'الاسم', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'phone', header: 'الهاتف', render: (c) => <span className="ltr font-mono text-sm" dir="ltr">{c.phone}</span> },
    { key: 'address', header: 'العنوان', render: (c) => c.address ?? '-' },
    { key: 'status', header: 'الحالة', render: () => <Badge variant="success">نشط</Badge> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (c) => (
        <div className="flex items-center gap-1">
          <ActionButton onClick={() => setViewing(c)} icon={Eye} label="عرض" />
          <ActionButton onClick={() => openEdit(c)} icon={Edit2} label="تعديل" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="العملاء" description="إدارة عملاء المتجر" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> إضافة عميل
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الهاتف..." /></div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا يوجد عملاء" emptyDescription="ابدأ بإضافة عميل جديد" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل عميل' : 'إضافة عميل جديد'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="اسم العميل" />
          <FormInput label="الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required placeholder="رقم الهاتف" dir="ltr" />
          <FormTextarea label="العنوان" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="عنوان العميل" />
          <SubmitButton loading={loading} label={editing ? 'حفظ التغييرات' : 'إضافة'} />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="تفاصيل العميل">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-6 h-6 text-primary" /></div>
              <div><p className="font-bold text-foreground">{viewing.name}</p><Badge variant="success">نشط</Badge></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-muted-foreground" /><span className="text-sm ltr" dir="ltr">{viewing.phone}</span></div>
              <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{viewing.address ?? 'غير محدد'}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, UserCog, Lock } from 'lucide-react';
import { usersService } from '@/api/users';
import { branchesService } from '@/api/branches';
import { extractApiError } from '@/api/client';
import type { User, UserRole } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, SubmitButton } from '@/components/shared/Modal';
import { getRoleLabel } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'EMPLOYEE' as UserRole, branchId: '', active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: users, isLoading, error: queryError } = useQuery({ queryKey: ['users'], queryFn: usersService.getAll });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });

  const filtered = (users ?? []).filter((u) => u.username.includes(search) || u.fullName.includes(search));

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', password: '', fullName: '', role: 'EMPLOYEE', branchId: '', active: true });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role, branchId: u.branchId ? String(u.branchId) : '', active: u.active });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const branchIdNum = form.branchId ? Number(form.branchId) : undefined;
      if (editing) {
        const payload: Record<string, unknown> = { username: form.username, fullName: form.fullName, role: form.role, branchId: branchIdNum, active: form.active };
        if (form.password) payload.password = form.password;
        await usersService.update(editing.id, payload as never);
        toast.success('تم تحديث المستخدم بنجاح');
      } else {
        await usersService.create({ username: form.username, password: form.password, fullName: form.fullName, role: form.role, branchId: branchIdNum, active: form.active });
        toast.success('تم إضافة المستخدم بنجاح');
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<User>[] = [
    { key: 'username', header: 'اسم المستخدم', render: (u) => <span className="font-mono text-sm">{u.username}</span> },
    { key: 'fullName', header: 'الاسم الكامل', render: (u) => <span className="font-medium">{u.fullName}</span> },
    { key: 'role', header: 'الدور', render: (u) => <Badge variant={u.role === 'ADMIN' ? 'info' : 'default'}>{getRoleLabel(u.role)}</Badge> },
    { key: 'branch', header: 'الفرع', render: (u) => {
      const branch = branches?.find((b) => b.id === u.branchId);
      return branch?.name ?? '-';
    }},
    { key: 'active', header: 'الحالة', render: (u) => <Badge variant={u.active ? 'success' : 'destructive'}>{u.active ? 'نشط' : 'معطل'}</Badge> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (u) => (
        <div className="flex items-center gap-1">
          {u.id !== currentUser?.id && <ActionButton onClick={() => openEdit(u)} icon={Edit2} label="تعديل" />}
          {u.id === currentUser?.id && <span className="text-xs text-muted-foreground px-2">أنت</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="المستخدمون" description="إدارة مستخدمي النظام" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> إضافة مستخدم
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث باسم المستخدم أو الاسم الكامل..." /></div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا يوجد مستخدمون" emptyDescription="ابدأ بإضافة مستخدم جديد" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="اسم المستخدم" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required placeholder="username" dir="ltr" />
          <FormInput label={editing ? 'كلمة المرور (اتركها فارغة لعدم التغيير)' : 'كلمة المرور'} value={form.password} onChange={(v) => setForm({ ...form, password: v })} required={!editing} placeholder="كلمة المرور" dir="ltr" />
          <FormInput label="الاسم الكامل" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required placeholder="الاسم الكامل" />
          <FormSelect label="الدور" value={form.role} onChange={(v) => setForm({ ...form, role: v as UserRole })} required options={[{ value: 'ADMIN', label: 'مدير' }, { value: 'EMPLOYEE', label: 'موظف' }]} />
          <FormSelect label="الفرع" value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} placeholder="بدون فرع" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm({ ...form, active: !form.active })} className={`relative w-12 h-6 rounded-full transition-colors ${form.active ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.active ? 'left-0.5' : 'right-0.5'}`} />
            </button>
            <label className="text-sm font-medium">نشط</label>
          </div>
          <SubmitButton loading={loading} label={editing ? 'حفظ التغييرات' : 'إضافة'} />
        </form>
      </Modal>
    </div>
  );
}

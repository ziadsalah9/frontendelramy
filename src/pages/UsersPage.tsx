import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Eye, EyeOff } from 'lucide-react';
import { usersService } from '@/api/users';
import { extractApiError } from '@/api/client';
import type { User, UserRole, UserUpdateInput } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormError, SubmitButton } from '@/components/shared/Modal';
import { getRoleLabel } from '@/utils/format';
import { passwordError, matches, MAX_NAME } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { useMainBranch } from '@/hooks/useMainBranch';
import { toast } from 'sonner';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'EMPLOYEE' as UserRole, active: true });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'username' | 'password' | 'fullName', string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: users, isLoading, error: queryError } = useQuery({ queryKey: ['users'], queryFn: usersService.getAll });
  // Single-branch mode: every employee works in the shop's one branch.
  const { branchId: mainBranchId } = useMainBranch();

  const filtered = (users ?? []).filter((u) => matches(u.username, search) || matches(u.fullName, search));

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', password: '', fullName: '', role: 'EMPLOYEE', active: true });
    setFieldErrors({});
    setShowPassword(false);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role, active: u.active });
    setFieldErrors({});
    setShowPassword(false);
    setError('');
    setModalOpen(true);
  };

  // Mirrors CreateUserRequest / UpdateUserRequest + UserServiceImpl.
  const validate = () => {
    const errs: typeof fieldErrors = {};
    const username = form.username.trim();
    if (!username) errs.username = 'اسم المستخدم مطلوب';
    else if (/\s/.test(username)) errs.username = 'اسم المستخدم لا يجب أن يحتوي على مسافات';
    else if ((users ?? []).some((u) => u.id !== editing?.id && u.username.toLowerCase() === username.toLowerCase())) {
      errs.username = 'اسم المستخدم مستخدم من قبل';
    }
    if (!form.fullName.trim()) errs.fullName = 'الاسم الكامل مطلوب';
    else if (form.fullName.trim().length > MAX_NAME) errs.fullName = `الاسم يجب ألا يزيد عن ${MAX_NAME} حرف`;
    if (!editing || form.password) {
      const pwErr = form.password ? passwordError(form.password) : 'كلمة المرور مطلوبة';
      if (pwErr) errs.password = pwErr;
    }
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('يرجى تصحيح الحقول المحددة');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // The backend requires a branch for employees and clears it for admins.
      const branchIdNum = form.role === 'EMPLOYEE' ? mainBranchId : undefined;
      if (form.role === 'EMPLOYEE' && !branchIdNum) {
        setError('لم يتم العثور على فرع نشط للمتجر');
        setLoading(false);
        return;
      }
      if (editing) {
        // An empty password field means "keep the current password",
        // which the backend handles by leaving it unchanged.
        const payload: UserUpdateInput = {
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          role: form.role,
          branchId: branchIdNum,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        };
        await usersService.update(editing.id, payload);
        toast.success('تم تحديث المستخدم بنجاح');
      } else {
        await usersService.create({ username: form.username.trim(), password: form.password, fullName: form.fullName.trim(), role: form.role, branchId: branchIdNum });
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
    { key: 'active', header: 'الحالة', render: (u) => <Badge variant={u.active ? 'success' : 'destructive'}>{u.active ? 'نشط' : 'معطل'}</Badge> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (u) => (
        <div className="flex items-center gap-1">
          {/* The whole /api/users surface is ADMIN-only, so only an admin
              reaches this page. An admin also cannot edit their own row. */}
          {isAdmin && u.id !== currentUser?.id && <ActionButton onClick={() => openEdit(u)} icon={Edit2} label="تعديل" />}
          {u.id === currentUser?.id && <span className="text-xs text-muted-foreground px-2">أنت</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="المستخدمون" description="إدارة مستخدمي النظام" action={
        isAdmin ? (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> إضافة مستخدم
          </button>
        ) : undefined
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث باسم المستخدم أو الاسم الكامل..." /></div>

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا يوجد مستخدمون" emptyDescription="ابدأ بإضافة مستخدم جديد" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'} persistent busy={loading}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormError message={error} />
          <FormInput label="اسم المستخدم" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required placeholder="username" dir="ltr" autoComplete="off" error={fieldErrors.username} />
          <div className="relative">
            <FormInput
              label={editing ? 'كلمة المرور (اتركها فارغة لعدم التغيير)' : 'كلمة المرور'}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              required={!editing}
              placeholder="10 أحرف على الأقل، حرف ورقم"
              dir="ltr"
              autoComplete="new-password"
              error={fieldErrors.password}
            />
            <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} className="absolute left-2 top-[34px] p-1 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FormInput label="الاسم الكامل" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required placeholder="الاسم الكامل" maxLength={MAX_NAME} error={fieldErrors.fullName} />
          <FormSelect label="الدور" value={form.role} onChange={(v) => setForm({ ...form, role: v as UserRole })} required options={[{ value: 'ADMIN', label: 'مدير' }, { value: 'EMPLOYEE', label: 'موظف' }]} />
          <p className="text-xs text-muted-foreground">
            {form.role === 'ADMIN' ? 'المدير له كل الصلاحيات، بما فيها الأسعار والمشتريات والمستخدمين.' : 'الموظف يمكنه البيع وإغلاق الكاش وعرض المنتجات والعملاء.'}
          </p>
          {/* New users are always created active by the backend, so the
              toggle only makes sense while editing an existing user. */}
          {editing && (
            <div className="flex items-center gap-3">
              <button type="button" role="switch" aria-checked={form.active} aria-label="نشط" onClick={() => setForm({ ...form, active: !form.active })} className={`relative w-12 h-6 rounded-full transition-colors ${form.active ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.active ? 'left-0.5' : 'right-0.5'}`} />
              </button>
              <label className="text-sm font-medium">نشط</label>
            </div>
          )}
          <SubmitButton loading={loading} label={editing ? 'حفظ التغييرات' : 'إضافة'} />
        </form>
      </Modal>
    </div>
  );
}

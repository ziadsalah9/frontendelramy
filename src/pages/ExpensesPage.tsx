import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { expensesService } from '@/api/expenses';
import { extractApiError } from '@/api/client';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, expenseCategoryLabel, type Expense, type ExpenseCategory, type PaymentMethod } from '@/types';
import { PageHeader, ConfirmDialog } from '@/components/shared/States';
import { DataTable, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormError, FormInput, FormSelect, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';
import { useMainBranch } from '@/hooks/useMainBranch';
import { formatCurrency, getPaymentMethodLabel, todayLocalISO } from '@/utils/format';
import { sanitizeDecimal, MAX_NOTES } from '@/utils/validation';

type Form = { category: ExpenseCategory | ''; description: string; amount: string; paymentMethod: PaymentMethod; expenseDate: string };

/** Rent, salaries, electricity...: cash ones come out of that day's drawer (ADMIN). */
export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const range = useDateRange();
  const params = { from: range.from, to: range.to };
  const { data, isLoading, error } = useQuery({ queryKey: ['expenses', params], queryFn: () => expensesService.getAll(params) });
  const { branchId } = useMainBranch();

  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Form>({ category: '', description: '', amount: '', paymentMethod: 'CASH', expenseDate: todayLocalISO() });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const total = (data ?? []).reduce((s, e) => s + e.amount, 0);
  const cash = (data ?? []).filter((e) => e.paymentMethod === 'CASH').reduce((s, e) => s + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES
    .map((c) => ({ ...c, amount: (data ?? []).filter((e) => e.category === c.value).reduce((s, e) => s + e.amount, 0) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const open = (e: Expense | null) => {
    setEditing(e);
    setForm(e
      ? { category: e.category, description: e.description ?? '', amount: String(e.amount), paymentMethod: e.paymentMethod, expenseDate: e.expenseDate }
      : { category: '', description: '', amount: '', paymentMethod: 'CASH', expenseDate: todayLocalISO() });
    setFormError('');
    setFormOpen(true);
  };

  const refresh = () => ['expenses', 'cash-closings-summary', 'reports', 'activity-logs'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    if (!form.category) return setFormError('اختر نوع المصروف');
    if (!(Number(form.amount) > 0)) return setFormError('المبلغ يجب أن يكون أكبر من صفر');
    if (!form.expenseDate || form.expenseDate > todayLocalISO()) return setFormError('اختر تاريخاً لا يتجاوز اليوم');
    if (!branchId) return setFormError('لم يتم العثور على الفرع');
    setSaving(true);
    setFormError('');
    const input = { branchId, category: form.category, description: form.description.trim() || null, amount: Number(form.amount), paymentMethod: form.paymentMethod, expenseDate: form.expenseDate };
    try {
      if (editing) await expensesService.update(editing.id, input);
      else await expensesService.create(input);
      toast.success(editing ? 'تم تعديل المصروف' : 'تم تسجيل المصروف');
      refresh();
      setFormOpen(false);
    } catch (err) {
      setFormError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting || busyDelete) return;
    setBusyDelete(true);
    try {
      await expensesService.remove(deleting.id);
      toast.success('تم حذف المصروف');
      refresh();
      setDeleting(null);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setBusyDelete(false);
    }
  };

  const columns: Column<Expense>[] = [
    { key: 'date', header: 'التاريخ', render: (e) => <span className="whitespace-nowrap" dir="ltr">{e.expenseDate}</span> },
    { key: 'category', header: 'النوع', render: (e) => <Badge variant="info">{expenseCategoryLabel(e.category)}</Badge> },
    { key: 'description', header: 'الوصف', render: (e) => e.description ?? '-' },
    { key: 'amount', header: 'المبلغ', render: (e) => <span className="font-bold whitespace-nowrap">{formatCurrency(e.amount)} ج.م</span> },
    { key: 'method', header: 'الدفع', render: (e) => getPaymentMethodLabel(e.paymentMethod) },
    {
      key: 'actions', header: '', className: 'text-left w-px',
      render: (e) => (
        <div className="flex gap-1 justify-end">
          <ActionButton onClick={() => open(e)} icon={Edit2} label="تعديل" />
          <ActionButton onClick={() => setDeleting(e)} icon={Trash2} label="حذف" variant="destructive" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="المصروفات" description="الإيجار والرواتب والكهرباء وغيرها، المصروف النقدي يُخصم من كاش يومه"
        action={
          <button type="button" onClick={() => open(null)} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> مصروف جديد
          </button>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">إجمالي المصروفات</p><p className="text-xl font-bold text-destructive">{formatCurrency(total)} ج.م</p><p className="text-xs text-muted-foreground">{data?.length ?? 0} مصروف</p></div>
        <div className="p-4 rounded-xl border bg-card"><p className="text-xs text-muted-foreground mb-1">منها نقداً من الدرج</p><p className="text-xl font-bold">{formatCurrency(cash)} ج.م</p></div>
        <div className="col-span-2 p-4 rounded-xl border bg-card">
          <p className="text-xs text-muted-foreground mb-2">حسب النوع</p>
          {byCategory.length === 0 ? <p className="text-sm text-muted-foreground">-</p> : (
            <div className="flex flex-wrap gap-2">
              {byCategory.map((c) => <span key={c.value} className="text-xs px-2 py-1 rounded-md bg-muted">{c.label}: <strong>{formatCurrency(c.amount)}</strong></span>)}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <DateRangeFilter from={range.from} to={range.to} onFrom={range.setFrom} onTo={range.setTo} onReset={range.reset} showReset={!range.isDefault} idPrefix="expenses" />
      </div>

      <DataTable columns={columns} data={data ?? []} loading={isLoading} error={error ? extractApiError(error).message : null}
        emptyTitle="لا توجد مصروفات في هذه الفترة" emptyDescription="سجّل الإيجار والرواتب وغيرها لتظهر الأرباح الصافية في التقارير" />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `تعديل ${editing.expenseNumber}` : 'مصروف جديد'} persistent busy={saving}>
        <form onSubmit={save} className="space-y-4" noValidate>
          <FormError message={formError} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect label="النوع" value={form.category} onChange={(v) => setForm({ ...form, category: v as ExpenseCategory })} options={EXPENSE_CATEGORIES} required placeholder="اختر النوع" />
            <FormInput label="المبلغ (ج.م)" type="text" inputMode="decimal" value={form.amount} onChange={(v) => setForm({ ...form, amount: sanitizeDecimal(v) })} required dir="ltr" />
            <FormSelect label="طريقة الدفع" value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })}
              options={PAYMENT_METHODS.filter((m) => m.value !== 'MIXED').map((m) => ({ value: m.value, label: m.label }))} />
            <FormInput label="التاريخ" type="date" value={form.expenseDate} onChange={(v) => setForm({ ...form, expenseDate: v })} max={todayLocalISO()} required />
          </div>
          <FormTextarea label="الوصف" value={form.description} onChange={(v) => setForm({ ...form, description: v })} maxLength={MAX_NOTES} placeholder="مثال: إيجار شهر أكتوبر" />
          <SubmitButton loading={saving} label={editing ? 'حفظ' : 'تسجيل'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onConfirm={remove} onCancel={() => setDeleting(null)} loading={busyDelete} destructive
        title="حذف مصروف" description={deleting ? `حذف ${deleting.expenseNumber} (${formatCurrency(deleting.amount)} ج.م)؟ يبقى أثره في سجل النشاط.` : ''} confirmText="حذف" />
    </div>
  );
}

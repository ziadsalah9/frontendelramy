import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Edit2, Power, Wallet, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { suppliersService } from '@/api/suppliers';
import { extractApiError } from '@/api/client';
import { PAYMENT_METHODS, type PaymentMethod, type Supplier } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormError, FormInput, FormSelect, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { useMainBranch } from '@/hooks/useMainBranch';
import { formatCurrency, formatDate } from '@/utils/format';
import { matches, sanitizeDecimal, sanitizePhone, isValidPhone, MAX_ADDRESS, MAX_NAME, MAX_NOTES } from '@/utils/validation';

type Form = { name: string; phone: string; address: string; notes: string };
const EMPTY: Form = { name: '', phone: '', address: '', notes: '' };

/** Suppliers, what we owe each one, and payments to them (ADMIN). */
export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['suppliers'], queryFn: suppliersService.getAll });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  const rows = (data ?? []).filter((s) => matches(s.name, search) || matches(s.phone, search));
  const totalOwed = (data ?? []).reduce((sum, s) => sum + Math.max(0, s.balance), 0);

  const open = (s: Supplier | null) => {
    setEditing(s);
    setForm(s ? { name: s.name, phone: s.phone ?? '', address: s.address ?? '', notes: s.notes ?? '' } : EMPTY);
    setFormError('');
    setFormOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) return setFormError('اسم المورد مطلوب');
    if (form.phone && !isValidPhone(form.phone)) return setFormError('رقم الهاتف يجب أن يتكون من 7 إلى 20 رقماً');
    setSaving(true);
    setFormError('');
    const input = { name: form.name.trim(), phone: form.phone || null, address: form.address.trim() || null, notes: form.notes.trim() || null };
    try {
      if (editing) await suppliersService.update(editing.id, input);
      else await suppliersService.create(input);
      toast.success(editing ? 'تم تعديل المورد' : 'تمت إضافة المورد');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setFormOpen(false);
    } catch (err) {
      setFormError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s: Supplier) => {
    try {
      await suppliersService.toggle(s.id);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const columns: Column<Supplier>[] = [
    { key: 'name', header: 'المورد', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'phone', header: 'الهاتف', render: (s) => <span dir="ltr" className="font-mono text-sm">{s.phone ?? '-'}</span> },
    {
      key: 'balance', header: 'المستحق له',
      render: (s) => <span className={`font-bold whitespace-nowrap ${s.balance > 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(s.balance)} ج.م</span>,
    },
    { key: 'status', header: 'الحالة', render: (s) => <Badge variant={s.active ? 'success' : 'default'}>{s.active ? 'نشط' : 'موقوف'}</Badge> },
    {
      key: 'actions', header: '', className: 'text-left w-px',
      render: (s) => (
        <div className="flex gap-1 justify-end">
          <ActionButton onClick={() => setViewing(s)} icon={Eye} label="الحساب" />
          <ActionButton onClick={() => open(s)} icon={Edit2} label="تعديل" />
          <ActionButton onClick={() => void toggle(s)} icon={Power} label={s.active ? 'إيقاف' : 'تفعيل'} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="الموردين"
        description={`إجمالي المستحق للموردين: ${formatCurrency(totalOwed)} ج.م`}
        action={
          <button type="button" onClick={() => open(null)} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> مورد جديد
          </button>
        }
      />
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الهاتف..." /></div>
      <DataTable columns={columns} data={rows} loading={isLoading} error={error ? extractApiError(error).message : null}
        emptyTitle="لا يوجد موردين بعد" emptyDescription="أضف المورد قبل تسجيل فاتورة شراء منه" onRowClick={(s) => setViewing(s)} />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'تعديل مورد' : 'مورد جديد'} persistent busy={saving}>
        <form onSubmit={save} className="space-y-4" noValidate>
          <FormError message={formError} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required maxLength={MAX_NAME} />
            <FormInput label="الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: sanitizePhone(v) })} dir="ltr" inputMode="tel" maxLength={21} placeholder="اختياري" />
          </div>
          <FormInput label="العنوان" value={form.address} onChange={(v) => setForm({ ...form, address: v })} maxLength={MAX_ADDRESS} placeholder="اختياري" />
          <FormTextarea label="ملاحظات" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} maxLength={MAX_NOTES} placeholder="اختياري" />
          <SubmitButton loading={saving} label={editing ? 'حفظ' : 'إضافة'} />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`حساب المورد: ${viewing?.name ?? ''}`} maxWidth="max-w-2xl">
        {viewing && <SupplierAccountPanel supplierId={viewing.id} />}
      </Modal>
    </div>
  );
}

const ENTRY_LABEL = { PURCHASE: 'فاتورة شراء', PAYMENT: 'دفعة' } as const;

function SupplierAccountPanel({ supplierId }: { supplierId: number }) {
  const queryClient = useQueryClient();
  const account = useQuery({ queryKey: ['supplier-account', supplierId], queryFn: () => suppliersService.getAccount(supplierId) });
  const { branchId } = useMainBranch();
  const [payOpen, setPayOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const balance = account.data?.balance ?? 0;

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const n = Number(amount);
    if (!(n > 0)) return setError('اكتب مبلغاً أكبر من صفر');
    if (n > balance) return setError(`المبلغ أكبر من المستحق (${formatCurrency(balance)} ج.م)`);
    if (!branchId) return setError('لم يتم العثور على الفرع');
    setSaving(true);
    setError('');
    try {
      const p = await suppliersService.pay(supplierId, { branchId, amount: n, paymentMethod: method, notes: notes.trim() || undefined });
      toast.success(`تم تسجيل الدفعة ${p.paymentNumber}`);
      ['supplier-account', 'suppliers', 'supplier-payments', 'cash-closings-summary', 'activity-logs'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setPayOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (account.isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل...</p>;
  if (account.error || !account.data) return <p className="text-sm text-destructive">{extractApiError(account.error).message}</p>;
  const a = account.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المشتريات</p><p className="font-bold">{formatCurrency(a.purchasesTotal)}</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">مدفوع عند الشراء</p><p className="font-bold">{formatCurrency(a.paidAtPurchase)}</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">دفعات لاحقة</p><p className="font-bold">{formatCurrency(a.laterPayments)}</p></div>
        <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المستحق له</p><p className={`font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(balance)} ج.م</p></div>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={() => { setAmount(balance > 0 ? String(balance) : ''); setMethod('CASH'); setNotes(''); setError(''); setPayOpen(true); }}
          disabled={balance <= 0} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          <Wallet className="w-4 h-4" /> دفع للمورد
        </button>
      </div>
      {a.entries.length > 0 && (
        <div>
          <button type="button" onClick={() => setStatementOpen((o) => !o)} aria-expanded={statementOpen} className="flex items-center gap-1 text-sm text-primary hover:underline">
            كشف الحساب ({a.entries.length}) <ChevronDown className={`w-4 h-4 transition-transform ${statementOpen ? 'rotate-180' : ''}`} />
          </button>
          {statementOpen && (
            <div className="mt-2 max-h-80 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0"><tr><th className="text-right p-2">التاريخ</th><th className="text-right p-2">البيان</th><th className="text-right p-2">المبلغ</th><th className="text-right p-2">الرصيد</th></tr></thead>
                <tbody>
                  {a.entries.map((e) => (
                    <tr key={`${e.type}-${e.id}`} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</td>
                      <td className="p-2"><span className="font-medium">{ENTRY_LABEL[e.type]}</span> <span dir="ltr" className="font-mono">{e.number}</span><span className="block text-muted-foreground">{e.description}</span></td>
                      <td className={`p-2 whitespace-nowrap font-medium ${e.amount < 0 ? 'text-success' : 'text-destructive'}`} dir="ltr">{formatCurrency(e.amount)}</td>
                      <td className="p-2 whitespace-nowrap" dir="ltr">{formatCurrency(e.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`دفع للمورد ${a.supplierName}`} persistent busy={saving}>
        <form onSubmit={pay} className="space-y-4" noValidate>
          <p className="text-sm">المستحق للمورد: <strong className="text-destructive">{formatCurrency(balance)} ج.م</strong></p>
          <FormError message={error} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="المبلغ (ج.م)" type="text" inputMode="decimal" value={amount} onChange={(v) => setAmount(sanitizeDecimal(v))} required dir="ltr" />
            <FormSelect label="طريقة الدفع" value={method} onChange={(v) => setMethod(v as PaymentMethod)}
              options={PAYMENT_METHODS.filter((m) => m.value !== 'MIXED').map((m) => ({ value: m.value, label: m.label }))} />
          </div>
          <FormTextarea label="ملاحظات" value={notes} onChange={setNotes} maxLength={MAX_NOTES} placeholder="اختياري" />
          <p className="text-xs text-muted-foreground">الدفع نقداً يُخصم من كاش اليوم في إغلاق الكاش.</p>
          <SubmitButton loading={saving} label="تسجيل الدفعة" />
        </form>
      </Modal>
    </div>
  );
}

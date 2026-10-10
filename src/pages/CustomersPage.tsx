import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Eye, Phone, MapPin, User, Trash2, RotateCcw, Receipt, ChevronDown, ArrowRight } from 'lucide-react';
import { customersService } from '@/api/customers';
import { salesInvoicesService } from '@/api/salesInvoices';
import { extractApiError } from '@/api/client';
import type { Customer } from '@/types';
import { formatCurrency, formatDate, getPaymentMethodLabel, variantLabel } from '@/utils/format';
import { PageHeader, ConfirmDialog, LoadingState, ErrorState, EmptyState } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { CustomerAccountPanel } from '@/components/customers/CustomerAccountPanel';
import { Modal, FormInput, FormTextarea, FormError, SubmitButton } from '@/components/shared/Modal';
import { sanitizePhone, isValidPhone, matches, MAX_NAME, MAX_ADDRESS } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type FieldErrors = Partial<Record<'name' | 'phone' | 'secondaryPhone' | 'address', string>>;
const emptyForm = { name: '', phone: '', secondaryPhone: '', address: '' };

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [invoicesFor, setInvoicesFor] = useState<Customer | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: customers, isLoading, error: queryError } = useQuery({ queryKey: ['customers'], queryFn: customersService.getAll });

  // Invoices of the customer being viewed or deleted. The delete dialog
  // uses this to say up front whether the customer will be removed or only
  // deactivated (the backend keeps customers that have invoices).
  const invoiceCustomer = deleteTarget ?? viewing ?? invoicesFor;
  const { data: customerInvoices, isLoading: invoicesLoading, error: invoicesError } = useQuery({
    queryKey: ['sales-invoices', 'customer', invoiceCustomer?.phone],
    queryFn: () => salesInvoicesService.getByCustomerPhone(invoiceCustomer!.phone),
    enabled: !!invoiceCustomer,
  });
  const invoiceCount = customerInvoices?.length ?? 0;
  const sortedInvoices = [...(customerInvoices ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const invoiceTotals = sortedInvoices.reduce(
    (t, inv) => ({ total: t.total + (inv.total ?? 0), paid: t.paid + (inv.paid ?? 0), remaining: t.remaining + (inv.remaining ?? 0) }),
    { total: 0, paid: 0, remaining: 0 },
  );

  const openInvoices = (c: Customer) => {
    setViewing(null);
    setExpandedInvoiceId(null);
    setInvoicesFor(c);
  };

  const inactiveCount = (customers ?? []).filter((c) => c.active === false).length;
  const filtered = (customers ?? []).filter(
    (c) =>
      (showInactive || c.active !== false) &&
      (matches(c.name, search) ||
        matches(c.phone, search) ||
        matches(c.secondaryPhone, search) ||
        matches(c.address, search)),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setError('');
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, secondaryPhone: c.secondaryPhone ?? '', address: c.address ?? '' });
    setFieldErrors({});
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    // Mirrors Create/UpdateCustomerRequest + CustomerServiceImpl.
    const errs: FieldErrors = {};
    const name = form.name.trim();
    const phone = form.phone.trim();
    const secondaryPhone = form.secondaryPhone.trim();
    if (!name) errs.name = 'اسم العميل مطلوب';
    else if (name.length > MAX_NAME) errs.name = `الاسم يجب ألا يزيد عن ${MAX_NAME} حرف`;
    if (!phone) errs.phone = 'رقم الهاتف الأساسي مطلوب';
    else if (!isValidPhone(phone)) errs.phone = 'رقم الهاتف يجب أن يتكون من 7 إلى 20 رقماً';
    else if ((customers ?? []).some((c) => c.id !== editing?.id && c.phone === phone)) errs.phone = 'رقم الهاتف مسجل لعميل آخر';
    if (secondaryPhone) {
      if (!isValidPhone(secondaryPhone)) errs.secondaryPhone = 'رقم الهاتف يجب أن يتكون من 7 إلى 20 رقماً';
      else if (secondaryPhone === phone) errs.secondaryPhone = 'الرقم الثانوي يجب أن يختلف عن الرقم الأساسي';
    }
    if (form.address.trim().length > MAX_ADDRESS) errs.address = `العنوان يجب ألا يزيد عن ${MAX_ADDRESS} حرف`;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('يرجى تصحيح الحقول المحددة');
      return;
    }
    setLoading(true);
    setError('');
    const payload = {
      name,
      phone,
      secondaryPhone: secondaryPhone || undefined,
      address: form.address.trim() || undefined,
    };
    try {
      if (editing) {
        await customersService.update(editing.id, payload);
        toast.success('تم تحديث العميل بنجاح');
      } else {
        await customersService.create(payload);
        toast.success('تم إضافة العميل بنجاح');
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      // Invoices show the customer's name and phone.
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await customersService.delete(deleteTarget.id);
      toast.success(
        result.permanentlyDeleted
          ? 'تم حذف العميل نهائياً'
          : 'العميل لديه فواتير، لذلك تم إخفاؤه مع الاحتفاظ بسجل فواتيره',
      );
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      // Invoices show the customer's name and phone.
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (c: Customer) => {
    if (restoringId) return;
    setRestoringId(c.id);
    try {
      await customersService.update(c.id, {
        name: c.name,
        phone: c.phone,
        secondaryPhone: c.secondaryPhone || undefined,
        address: c.address || undefined,
        active: true,
      });
      toast.success('تمت استعادة العميل');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      // Invoices show the customer's name and phone.
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setRestoringId(null);
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name', header: 'الاسم',
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{c.name}</span>
          {c.active === false && <Badge variant="destructive">محذوف</Badge>}
        </div>
      ),
    },
    { key: 'phone', header: 'الهاتف', render: (c) => <span className="font-mono text-sm" dir="ltr">{c.phone}</span> },
    { key: 'address', header: 'العنوان', render: (c) => <span className="line-clamp-1">{c.address || '-'}</span> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left w-px',
      render: (c) => (
        <div className="flex items-center gap-1">
          <ActionButton onClick={() => setViewing(c)} icon={Eye} label="عرض التفاصيل" />
          {isAdmin && c.active !== false && <ActionButton onClick={() => openEdit(c)} icon={Edit2} label="تعديل" />}
          {isAdmin && c.active !== false && <ActionButton onClick={() => setDeleteTarget(c)} icon={Trash2} label="حذف" variant="destructive" />}
          {isAdmin && c.active === false && (
            <ActionButton onClick={() => void handleRestore(c)} icon={RotateCcw} label={restoringId === c.id ? 'جاري الاستعادة...' : 'استعادة'} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="العملاء" description="إدارة عملاء المتجر" action={
        isAdmin ? (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> إضافة عميل
          </button>
        ) : undefined
      } />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الهاتف أو العنوان..." />
        {inactiveCount > 0 && (
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            aria-pressed={showInactive}
            className={`h-10 px-3 rounded-lg border text-sm transition-colors ${showInactive ? 'bg-muted border-foreground/20' : 'border-input bg-background hover:bg-accent'}`}
          >
            {showInactive ? 'إخفاء المحذوفين' : `إظهار المحذوفين (${inactiveCount})`}
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={setViewing}
        rowLabel={(c) => `فتح العميل ${c.name}`}
        loading={isLoading}
        error={queryError ? extractApiError(queryError).message : null}
        emptyTitle={search ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء'}
        emptyDescription={search ? 'جرّب البحث بالاسم أو رقم الهاتف أو العنوان' : isAdmin ? 'ابدأ بإضافة عميل جديد' : undefined}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل عميل' : 'إضافة عميل جديد'} persistent busy={loading}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormError message={error} />
          <FormInput label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="اسم العميل" maxLength={MAX_NAME} error={fieldErrors.name} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="الهاتف الأساسي" value={form.phone} onChange={(v) => setForm({ ...form, phone: sanitizePhone(v) })} required placeholder="01xxxxxxxxx" dir="ltr" inputMode="tel" maxLength={21} error={fieldErrors.phone} />
            <FormInput label="هاتف ثانوي" value={form.secondaryPhone} onChange={(v) => setForm({ ...form, secondaryPhone: sanitizePhone(v) })} placeholder="اختياري" dir="ltr" inputMode="tel" maxLength={21} error={fieldErrors.secondaryPhone} />
          </div>
          <FormTextarea label="العنوان" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="المنطقة، الشارع، علامة مميزة..." maxLength={MAX_ADDRESS} error={fieldErrors.address} />
          <SubmitButton loading={loading} label={editing ? 'حفظ التغييرات' : 'إضافة'} />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="تفاصيل العميل" maxWidth="max-w-2xl">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="w-6 h-6 text-primary" /></div>
              <div className="flex-1 min-w-0"><p className="font-bold text-foreground truncate">{viewing.name}</p></div>
              <Badge variant={viewing.active === false ? 'destructive' : 'success'}>{viewing.active === false ? 'محذوف' : 'نشط'}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> الهاتف الأساسي</p>
                <a href={`tel:${viewing.phone}`} className="text-sm font-medium font-mono hover:text-primary" dir="ltr">{viewing.phone}</a>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> الهاتف الثانوي</p>
                {viewing.secondaryPhone
                  ? <a href={`tel:${viewing.secondaryPhone}`} className="text-sm font-medium font-mono hover:text-primary" dir="ltr">{viewing.secondaryPhone}</a>
                  : <p className="text-sm text-muted-foreground">غير مسجل</p>}
              </div>
              <div className="p-3 rounded-lg border sm:col-span-2">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> العنوان</p>
                <p className="text-sm font-medium whitespace-pre-line">{viewing.address || 'غير محدد'}</p>
              </div>
              <div className="p-3 rounded-lg border sm:col-span-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> فواتير البيع</p>
                  <p className="text-sm font-medium">
                    {invoicesLoading ? 'جاري التحميل...' : `${invoiceCount} فاتورة`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openInvoices(viewing)}
                  disabled={invoicesLoading || invoiceCount === 0}
                  className="flex items-center gap-2 h-9 px-3 rounded-lg border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Receipt className="w-4 h-4" /> عرض كل الفواتير
                </button>
              </div>
              <div className="sm:col-span-2"><CustomerAccountPanel customerId={viewing.id} /></div>
            </div>
            {isAdmin && viewing.active !== false && (
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => { setDeleteTarget(viewing); setViewing(null); }} className="flex items-center gap-2 h-10 px-4 rounded-lg border border-destructive/40 text-destructive text-sm hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" /> حذف
                </button>
                <button type="button" onClick={() => { openEdit(viewing); setViewing(null); }} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
                  <Edit2 className="w-4 h-4" /> تعديل
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!invoicesFor}
        onClose={() => setInvoicesFor(null)}
        title={`فواتير العميل - ${invoicesFor?.name ?? ''}`}
        maxWidth="max-w-3xl"
      >
        {invoicesFor && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => { setViewing(invoicesFor); setInvoicesFor(null); }}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ArrowRight className="w-4 h-4" /> رجوع لتفاصيل العميل
            </button>

            {invoicesLoading ? (
              <LoadingState />
            ) : invoicesError ? (
              <ErrorState message={extractApiError(invoicesError).message} />
            ) : sortedInvoices.length === 0 ? (
              <EmptyState title="لا توجد فواتير لهذا العميل" />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">عدد الفواتير</p><p className="font-bold">{sortedInvoices.length}</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">إجمالي المشتريات</p><p className="font-bold">{formatCurrency(invoiceTotals.total)} ج.م</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">المدفوع</p><p className="font-bold text-success">{formatCurrency(invoiceTotals.paid)} ج.م</p></div>
                  <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">المتبقي</p><p className={`font-bold ${invoiceTotals.remaining > 0 ? 'text-destructive' : ''}`}>{formatCurrency(invoiceTotals.remaining)} ج.م</p></div>
                </div>

                <ul className="space-y-2">
                  {sortedInvoices.map((inv) => {
                    const expanded = expandedInvoiceId === inv.id;
                    return (
                      <li key={inv.id} className="border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedInvoiceId(expanded ? null : inv.id)}
                          aria-expanded={expanded}
                          className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-right hover:bg-muted/30 transition-colors"
                        >
                          <span className="font-mono text-sm font-medium" dir="ltr">{inv.invoiceNumber}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</span>
                          <Badge variant="info">{getPaymentMethodLabel(inv.paymentMethod)}</Badge>
                          <span className="flex-1" />
                          {(inv.remaining ?? 0) > 0 && <Badge variant="destructive">متبقي {formatCurrency(inv.remaining)} ج.م</Badge>}
                          <span className="font-bold text-sm">{formatCurrency(inv.total)} ج.م</span>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        {expanded && (
                          <div className="border-t bg-muted/20 p-3 space-y-2">
                            {inv.items?.map((item, i) => (
                              <div key={item.id ?? i} className="flex items-center justify-between text-sm">
                                <div>
                                  <p className="font-medium">{item.productName ?? `#${item.productId}`}{variantLabel(item) && <span className="mr-2 px-1.5 py-0.5 rounded bg-muted text-xs font-normal">{variantLabel(item)}</span>}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.quantity} × {formatCurrency(item.unitPrice)} ج.م
                                    {item.discount > 0 && ` - خصم ${formatCurrency(item.discount)} ج.م`}
                                  </p>
                                </div>
                                <span className="font-medium">{formatCurrency(item.total)} ج.م</span>
                              </div>
                            ))}
                            <div className="flex flex-wrap justify-between gap-2 pt-2 border-t text-xs text-muted-foreground">
                              <span>الكاشير: {inv.cashierName ?? '-'}</span>
                              {inv.discount > 0 && <span>خصم الفاتورة{inv.discountPercent != null && ` (${inv.discountPercent}%)`}: {formatCurrency(inv.discount)} ج.م</span>}
                              <span>المدفوع: <span className="text-success font-medium">{formatCurrency(inv.paid)} ج.م</span></span>
                            </div>
                            {inv.notes && <p className="text-xs text-muted-foreground">ملاحظات: {inv.notes}</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting || invoicesLoading}
        title="حذف العميل"
        description={
          invoicesLoading
            ? 'جاري التحقق من فواتير العميل...'
            : invoiceCount > 0
              ? `"${deleteTarget?.name ?? ''}" لديه ${invoiceCount} فاتورة بيع، لذلك سيتم إخفاؤه من القائمة مع الاحتفاظ بفواتيره. يمكنك استعادته لاحقاً.`
              : `سيتم حذف "${deleteTarget?.name ?? ''}" نهائياً. لا يمكن التراجع عن هذا الإجراء.`
        }
        confirmText={invoiceCount > 0 ? 'إخفاء العميل' : 'حذف نهائي'}
        destructive
      />
    </div>
  );
}

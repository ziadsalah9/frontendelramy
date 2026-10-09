import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, X } from 'lucide-react';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { PurchaseInvoice, PaymentMethod, Product } from '@/types';
import { PAYMENT_METHODS } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormTextarea, FormError, SubmitButton } from '@/components/shared/Modal';
import { formatDate, formatCurrency, getPaymentMethodLabel, variantLabel } from '@/utils/format';
import { sanitizeDecimal, sanitizeInt, matches, MAX_INVOICE_NUMBER, MAX_NOTES } from '@/utils/validation';
import { useMainBranch } from '@/hooks/useMainBranch';
import { ClosedBranchBadge } from '@/components/shared/ClosedBranchBadge';
import { toast } from 'sonner';
import { useDateRange } from '@/hooks/useDateRange';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';

// variantId = the exact colour/size being bought.
interface FormItem { key: number; productId: string; variantId: string; quantity: string; unitPrice: string; discount: string; }

interface FormState {
  invoiceNumber: string;
  discount: string;
  paid: string;
  paidTouched: boolean;
  paymentMethod: PaymentMethod;
  notes: string;
  items: FormItem[];
}

type FieldErrors = Partial<Record<'invoiceNumber' | 'discount' | 'paid' | 'notes', string>>;

/** Stable React key: removing a middle line must not shift the others' inputs. */
let nextKey = 0;
const emptyItem = (): FormItem => ({ key: ++nextKey, productId: '', variantId: '', quantity: '1', unitPrice: '', discount: '0' });
const emptyForm = (): FormState => ({
  invoiceNumber: '', discount: '0', paid: '', paidTouched: false,
  paymentMethod: 'CASH', notes: '', items: [emptyItem()],
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function PurchaseInvoicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<PurchaseInvoice | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // One period at a time (this month by default) instead of all history.
  const range = useDateRange();
  const { data: invoices, isLoading, error: queryError } = useQuery({ queryKey: ['purchase-invoices', { from: range.from, to: range.to }], queryFn: () => purchaseInvoicesService.getAll({ from: range.from, to: range.to }) });
  // Single-branch mode: stock always goes into the shop's one branch.
  const { branchId: mainBranchId } = useMainBranch();
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const activeProducts = (products ?? []).filter((p) => p.active !== false);
  const activeVariantsOf = (p?: Product) => p?.variants.filter((v) => v.active !== false) ?? [];

  const filtered = (invoices ?? []).filter(
    (inv) => matches(inv.invoiceNumber, search) || matches(inv.notes, search),
  );

  const openCreate = () => {
    setForm(emptyForm());
    setFieldErrors({});
    setItemErrors({});
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
    setItemErrors({});
  };
  const updateItem = (idx: number, field: keyof FormItem, raw: string) => {
    let value = raw;
    if (field === 'quantity') value = sanitizeInt(raw);
    else if (field === 'unitPrice' || field === 'discount') value = sanitizeDecimal(raw);
    setForm((f) => {
      const items = f.items.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, [field]: value };
        if (field === 'productId') {
          const product = products?.find((p) => String(p.id) === value);
          // A product with a single colour/size is picked straight away.
          const vs = activeVariantsOf(product);
          next.variantId = vs.length === 1 ? String(vs[0].id) : '';
          // Pre-fill the cost from the product's current purchase price.
          if (value && !item.unitPrice && product?.currentPrice?.purchasePrice) next.unitPrice = String(product.currentPrice.purchasePrice);
        }
        return next;
      });
      return { ...f, items };
    });
    setItemErrors((e) => {
      if (!e[idx]) return e;
      const next = { ...e };
      delete next[idx];
      return next;
    });
  };

  const lineTotal = (item: FormItem) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0);
  const subtotal = round2(form.items.reduce((sum, item) => sum + (item.productId ? lineTotal(item) : 0), 0));
  const invoiceDiscount = Number(form.discount) || 0;
  const total = Math.max(0, round2(subtotal - invoiceDiscount));
  const paidValue = form.paidTouched ? form.paid : total.toString();
  const paid = Number(paidValue) || 0;
  const remaining = round2(total - paid);

  // Mirrors CreatePurchaseInvoiceRequest + PurchaseInvoiceServiceImpl.
  const validate = () => {
    const fields: FieldErrors = {};
    const items: Record<number, string> = {};

    const invoiceNumber = form.invoiceNumber.trim();
    if (!invoiceNumber) fields.invoiceNumber = 'رقم الفاتورة مطلوب';
    else if (invoiceNumber.length > MAX_INVOICE_NUMBER) fields.invoiceNumber = `رقم الفاتورة يجب ألا يزيد عن ${MAX_INVOICE_NUMBER} حرف`;
    else if ((invoices ?? []).some((inv) => inv.invoiceNumber.trim().toLowerCase() === invoiceNumber.toLowerCase())) {
      fields.invoiceNumber = 'رقم الفاتورة مستخدم من قبل';
    }
    if (form.notes.trim().length > MAX_NOTES) fields.notes = `الملاحظات يجب ألا تزيد عن ${MAX_NOTES} حرف`;

    const seen = new Set<string>();
    let lineCount = 0;
    form.items.forEach((item, idx) => {
      if (!item.productId) {
        if (form.items.length > 1 || item.quantity !== '1' || item.unitPrice) items[idx] = 'اختر المنتج أو احذف هذا البند';
        return;
      }
      lineCount++;
      const qty = Number(item.quantity);
      if (!item.variantId) items[idx] = 'اختر اللون/المقاس';
      else if (seen.has(item.variantId)) items[idx] = 'هذا اللون/المقاس مكرر في الفاتورة، اجمع الكمية في بند واحد';
      else if (!Number.isInteger(qty) || qty <= 0) items[idx] = 'الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر';
      else if (!(Number(item.unitPrice) > 0)) items[idx] = 'سعر الوحدة يجب أن يكون أكبر من صفر';
      else if (lineTotal(item) < 0) items[idx] = 'الخصم أكبر من إجمالي البند';
      if (item.variantId) seen.add(item.variantId);
    });

    if (invoiceDiscount > subtotal) fields.discount = 'خصم الفاتورة أكبر من إجمالي البنود';
    if (paidValue.trim() === '') fields.paid = 'أدخل المبلغ المدفوع';
    else if (paid > total) fields.paid = 'المدفوع لا يمكن أن يزيد عن إجمالي الفاتورة';

    return { fields, items, lineCount };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const { fields, items, lineCount } = validate();
    setFieldErrors(fields);
    setItemErrors(items);
    if (!mainBranchId) {
      setError('لم يتم العثور على فرع نشط للمتجر');
      return;
    }
    if (lineCount === 0) {
      setError('أضف منتجاً واحداً على الأقل');
      return;
    }
    if (Object.keys(fields).length > 0 || Object.keys(items).length > 0) {
      setError('يرجى تصحيح الحقول المحددة قبل الحفظ');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await purchaseInvoicesService.create({
        invoiceNumber: form.invoiceNumber.trim(),
        branchId: mainBranchId!,
        items: form.items
          .filter((i) => i.productId)
          .map((i) => ({ variantId: Number(i.variantId), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount) || 0 })),
        discount: invoiceDiscount,
        paid,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim() || undefined,
      });
      toast.success('تم إنشاء فاتورة الشراء بنجاح');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<PurchaseInvoice>[] = [
    {
      key: 'invoiceNumber', header: 'رقم الفاتورة',
      render: (inv) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium" dir="ltr">{inv.invoiceNumber}</span>
          <ClosedBranchBadge branchId={inv.branchId} branchName={inv.branchName} />
        </div>
      ),
    },
    { key: 'items', header: 'المنتجات', render: (inv) => <span className="text-sm">{inv.items?.length ?? 0} منتج</span> },
    { key: 'total', header: 'الإجمالي', render: (inv) => <span className="font-bold">{formatCurrency(inv.total)} ج.م</span> },
    { key: 'paid', header: 'المدفوع', render: (inv) => <span className="text-success font-medium">{formatCurrency(inv.paid)} ج.م</span> },
    { key: 'remaining', header: 'المتبقي', render: (inv) => <span className={inv.remaining && inv.remaining > 0 ? 'text-destructive font-medium' : ''}>{formatCurrency(inv.remaining)} ج.م</span> },
    { key: 'paymentMethod', header: 'طريقة الدفع', render: (inv) => <Badge variant="info">{getPaymentMethodLabel(inv.paymentMethod)}</Badge> },
    { key: 'createdAt', header: 'التاريخ', render: (inv) => <span className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</span> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (inv) => <ActionButton onClick={() => setViewing(inv)} icon={Eye} label="عرض" />,
    },
  ];

  const inputCls = (err?: string) =>
    `h-10 px-3 rounded-lg border bg-background text-sm ${err ? 'border-destructive' : 'border-input'}`;

  return (
    <div>
      <PageHeader title="فواتير الشراء" description="إدارة فواتير الشراء من الموردين" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> فاتورة شراء جديدة
        </button>
      } />

      <div className="mb-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث برقم الفاتورة أو الملاحظات..." />
        <DateRangeFilter from={range.from} to={range.to} onFrom={range.setFrom} onTo={range.setTo} onReset={range.reset} showReset={!range.isDefault} idPrefix="purchases" />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        error={queryError ? extractApiError(queryError).message : null}
        emptyTitle={search ? 'لا توجد نتائج مطابقة' : 'لا توجد فواتير شراء'}
        emptyDescription={search ? 'جرّب كلمة بحث أخرى' : 'ابدأ بإنشاء فاتورة شراء جديدة'}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="فاتورة شراء جديدة" maxWidth="max-w-3xl" persistent busy={loading}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormInput label="رقم فاتورة المورد" value={form.invoiceNumber} onChange={(v) => setForm({ ...form, invoiceNumber: v })} required placeholder="PUR-2026-0001" dir="ltr" maxLength={MAX_INVOICE_NUMBER} error={fieldErrors.invoiceNumber} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">المنتجات</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="w-4 h-4" /> إضافة منتج</button>
            </div>
            <div className="hidden sm:flex gap-2 px-1 mb-1 text-xs text-muted-foreground">
              <span className="flex-1">المنتج</span>
              <span className="w-36">اللون / المقاس</span>
              <span className="w-20">الكمية</span>
              <span className="w-28">سعر الوحدة</span>
              <span className="w-24">خصم البند</span>
              <span className="w-28">الإجمالي</span>
              {form.items.length > 1 && <span className="w-9" />}
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={item.key}>
                  <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                    <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} aria-label="المنتج" className={`flex-1 min-w-[160px] ${inputCls(itemErrors[idx])}`}>
                      <option value="">اختر منتج</option>
                      {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} - ` : ''}{p.name}</option>)}
                    </select>
                    <select value={item.variantId} onChange={(e) => updateItem(idx, 'variantId', e.target.value)} disabled={!item.productId} aria-label="اللون والمقاس" className={`w-36 ${inputCls(itemErrors[idx] && !item.variantId ? itemErrors[idx] : undefined)} disabled:bg-muted/30`}>
                      <option value="">اختر</option>
                      {activeVariantsOf(products?.find((p) => String(p.id) === item.productId)).map((v) => (
                        <option key={v.id} value={v.id}>{v.label} (الحالي: {v.quantity})</option>
                      ))}
                    </select>
                    <input type="text" inputMode="numeric" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} placeholder="الكمية" aria-label="الكمية" className={`w-20 ${inputCls()}`} dir="ltr" />
                    <input type="text" inputMode="decimal" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} placeholder="سعر الوحدة" aria-label="سعر الوحدة" className={`w-28 ${inputCls()}`} dir="ltr" />
                    <input type="text" inputMode="decimal" value={item.discount} onChange={(e) => updateItem(idx, 'discount', e.target.value)} placeholder="خصم" aria-label="خصم البند" className={`w-24 ${inputCls()}`} dir="ltr" />
                    <div className="w-28 h-10 px-3 flex items-center rounded-lg bg-muted/30 border border-input text-sm font-medium" dir="ltr">{item.productId ? formatCurrency(lineTotal(item)) : '-'}</div>
                    {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} aria-label="حذف البند" className="p-2.5 rounded-lg text-destructive hover:bg-destructive/10"><X className="w-4 h-4" /></button>}
                  </div>
                  {itemErrors[idx] && <p className="mt-1 text-xs text-destructive">{itemErrors[idx]}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormInput label="خصم الفاتورة (ج.م)" type="text" inputMode="decimal" value={form.discount} onChange={(v) => setForm({ ...form, discount: sanitizeDecimal(v) })} dir="ltr" error={fieldErrors.discount} />
            <FormSelect label="طريقة الدفع" value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })} options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))} />
            <FormInput label="المدفوع (ج.م)" type="text" inputMode="decimal" value={paidValue} onChange={(v) => setForm({ ...form, paid: sanitizeDecimal(v), paidTouched: true })} dir="ltr" error={fieldErrors.paid} />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">المتبقي</label>
              <div className={`h-10 px-3 flex items-center rounded-lg border text-sm font-bold ${remaining > 0 ? 'bg-destructive/5 border-destructive/30 text-destructive' : 'bg-muted/30 border-input'}`}>{formatCurrency(remaining)} ج.م</div>
            </div>
          </div>

          <div className="flex justify-end p-4 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-lg font-bold text-primary">الإجمالي: {formatCurrency(total)} ج.م</span>
          </div>

          <FormTextarea label="ملاحظات" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="ملاحظات الفاتورة" maxLength={MAX_NOTES} error={fieldErrors.notes} />
          <FormError message={error} />
          <SubmitButton loading={loading} label="إنشاء الفاتورة" />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`فاتورة شراء - ${viewing?.invoiceNumber ?? ''}`} maxWidth="max-w-2xl">
        {viewing && (
          <div className="space-y-4">
            <ClosedBranchBadge branchId={viewing.branchId} branchName={viewing.branchName} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">طريقة الدفع</p><Badge variant="info">{getPaymentMethodLabel(viewing.paymentMethod)}</Badge></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">التاريخ</p><p className="text-sm font-medium">{formatDate(viewing.createdAt)}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الإجمالي</p><p className="text-sm font-bold">{formatCurrency(viewing.total)} ج.م</p></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المدفوع</p><p className="text-success font-bold">{formatCurrency(viewing.paid)} ج.م</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المتبقي</p><p className={viewing.remaining && viewing.remaining > 0 ? 'text-destructive font-bold' : 'font-bold'}>{formatCurrency(viewing.remaining)} ج.م</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">خصم الفاتورة</p><p className="font-bold">{formatCurrency(viewing.discount)} ج.م</p></div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">المنتجات</h4>
              <div className="space-y-2">
                {viewing.items?.map((item, i) => (
                  <div key={item.id ?? i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{item.productName ?? products?.find((p) => p.id === item.productId)?.name ?? `#${item.productId}`}{variantLabel(item) && <span className="mr-2 px-1.5 py-0.5 rounded bg-muted text-xs font-normal">{variantLabel(item)}</span>}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unitPrice)} ج.م
                        {item.discount > 0 && ` - خصم ${formatCurrency(item.discount)} ج.م`}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(item.total ?? (item.quantity * (item.unitPrice ?? 0) - item.discount))} ج.م</span>
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

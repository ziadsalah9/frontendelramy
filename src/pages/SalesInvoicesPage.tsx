import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, X } from 'lucide-react';
import { salesInvoicesService } from '@/api/salesInvoices';
import { productsService } from '@/api/products';
import { customersService } from '@/api/customers';
import { extractApiError } from '@/api/client';
import type { SalesInvoice, PaymentMethod } from '@/types';
import { PAYMENT_METHODS } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormTextarea, FormError, SubmitButton } from '@/components/shared/Modal';
import { formatDate, formatCurrency, getPaymentMethodLabel, variantLabel } from '@/utils/format';
import {
  sanitizeDecimal, sanitizeInt, isValidPhone, matches,
  MAX_NAME, MAX_ADDRESS, MAX_NOTES,
} from '@/utils/validation';
import { useMainBranch } from '@/hooks/useMainBranch';
import { CustomerPicker, type CustomerMode } from '@/components/sales/CustomerPicker';
import { toast } from 'sonner';

interface FormItem {
  /** Stable React key: removing a middle line must not shift the others' inputs. */
  key: number;
  productId: string;
  /** The exact colour/size being sold. */
  variantId: string;
  quantity: string;
  /** Discount amount for the whole line, in EGP. This is what the API takes. */
  discount: string;
  discountPercent: string;
  /** Which discount field the user typed last; the other one is derived. */
  discountMode: 'percent' | 'amount';
}

interface FormState {
  /** Pick a registered customer, or type a new one. */
  customerMode: CustomerMode;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: PaymentMethod;
  discount: string;
  /** Only used once the cashier edits it; until then paid follows the total. */
  paid: string;
  paidTouched: boolean;
  notes: string;
  items: FormItem[];
}

type FieldErrors = Partial<Record<'branchId' | 'customer' | 'customerName' | 'customerPhone' | 'customerAddress' | 'discount' | 'paid' | 'notes' | 'items', string>>;

let nextKey = 0;
const emptyItem = (): FormItem => ({ key: ++nextKey, productId: '', variantId: '', quantity: '1', discount: '0', discountPercent: '0', discountMode: 'percent' });

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function SalesInvoicesPage() {
  const queryClient = useQueryClient();
  // Single-branch mode: every sale is for the shop's one branch.
  const { branchId: mainBranchId, isLoading: branchLoading } = useMainBranch();

  const makeEmptyForm = (): FormState => ({
    customerMode: 'existing',
    customerId: null,
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    paymentMethod: 'CASH',
    discount: '0',
    paid: '',
    paidTouched: false,
    notes: '',
    items: [emptyItem()],
  });

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<SalesInvoice | null>(null);
  const [form, setForm] = useState<FormState>(makeEmptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: invoices, isLoading, error: queryError } = useQuery({ queryKey: ['sales-invoices'], queryFn: salesInvoicesService.getAll });
  // Products carry their stock quantity, so one query feeds both the
  // product list and the "available" checks.
  const { data: products, isLoading: stocksLoading, error: stocksError } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });
  const branchIdNum = mainBranchId;

  // Registered customers, for the "existing customer" search.
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: customersService.getAll,
    enabled: modalOpen,
  });
  const phone = form.customerPhone.trim();
  const selectedCustomer = form.customerId != null ? (customers ?? []).find((c) => c.id === form.customerId) ?? null : null;


  const filtered = (invoices ?? []).filter(
    (inv) =>
      matches(inv.invoiceNumber, search) ||
      matches(inv.customer?.name, search) ||
      matches(inv.customer?.phone, search),
  );

  const priceByProduct = useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of products ?? []) {
      const selling = p.currentPrice?.sellingPrice;
      if (typeof selling === 'number') map[p.id] = selling;
    }
    return map;
  }, [products]);

  const availableByProduct = useMemo(() => {
    const map: Record<number, number> = {};
    for (const p of products ?? []) map[p.id] = p.quantity ?? 0;
    return map;
  }, [products]);

  // Stock is per colour/size (variant).
  const variantById = useMemo(() => {
    const map: Record<number, { productId: number; quantity: number; label: string; active: boolean }> = {};
    for (const p of products ?? []) {
      for (const v of p.variants ?? []) map[v.id] = { productId: p.id, quantity: v.quantity ?? 0, label: v.label, active: v.active !== false };
    }
    return map;
  }, [products]);
  const available = (vid: string) => (vid ? variantById[Number(vid)]?.quantity ?? 0 : 0);
  /** Colours/sizes of a product that can be sold now (in stock). */
  const sellableVariants = (pid: string) =>
    (products ?? []).find((p) => String(p.id) === pid)?.variants.filter((v) => v.active !== false && (v.quantity ?? 0) > 0) ?? [];
  const price = (pid: string) => (pid ? priceByProduct[Number(pid)] ?? 0 : 0);

  // Only active, priced products that are in stock
  // can be sold. A line keeps its current product even if it drops out.
  const sellableProducts = (products ?? []).filter(
    (p) => p.active !== false && (priceByProduct[p.id] ?? 0) > 0 && (availableByProduct[p.id] ?? 0) > 0,
  );

  const openCreate = () => {
    // Fresh quantities before selling (another cashier may have sold since).
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setForm(makeEmptyForm());
    setFieldErrors({});
    setItemErrors({});
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));

  // Scanner / typed code: finds the colour/size and adds it as a line, or
  // adds 1 to the line that already has it.
  const [scanCode, setScanCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const addByCode = async () => {
    const code = scanCode.trim();
    if (!code || scanning) return;
    setScanning(true);
    try {
      const { product, variant } = await productsService.lookupVariant(code);
      if (!product.currentPrice) throw new Error(`"${product.name}" ليس له سعر بيع`);
      if ((variant.quantity ?? 0) <= 0) throw new Error(`لا يوجد مخزون من ${product.name} (${variant.label})`);
      setForm((f) => {
        const at = f.items.findIndex((i) => i.variantId === String(variant.id));
        if (at >= 0) {
          return { ...f, items: f.items.map((i, k) => (k === at ? recalcDiscount({ ...i, quantity: String((Number(i.quantity) || 0) + 1) }) : i)) };
        }
        const line = { ...emptyItem(), productId: String(product.id), variantId: String(variant.id) };
        const empty = f.items.findIndex((i) => !i.productId);
        return { ...f, items: empty >= 0 ? f.items.map((i, k) => (k === empty ? line : i)) : [...f.items, line] };
      });
      setScanCode('');
    } catch (err) {
      toast.error(err instanceof Error && !('isAxiosError' in err) ? err.message : extractApiError(err).message);
    } finally {
      setScanning(false);
    }
  };
  const removeItem = (idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
    setItemErrors({});
  };

  const recalcDiscount = (item: FormItem): FormItem => {
    const gross = price(item.productId) * (Number(item.quantity) || 0);
    if (item.discountMode === 'percent') {
      const pct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
      return { ...item, discount: round2((gross * pct) / 100).toString() };
    }
    const amount = Number(item.discount) || 0;
    return { ...item, discountPercent: gross > 0 ? round2((amount / gross) * 100).toString() : '0' };
  };

  const updateItem = (idx: number, field: 'productId' | 'variantId' | 'quantity' | 'discount' | 'discountPercent', raw: string) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => {
        if (i !== idx) return item;
        switch (field) {
          case 'productId': {
            // A product with a single colour/size is picked straight away.
            const vs = sellableVariants(raw);
            return { ...emptyItem(), productId: raw, variantId: vs.length === 1 ? String(vs[0].id) : '', quantity: item.quantity || '1' };
          }
          case 'variantId':
            return recalcDiscount({ ...item, variantId: raw });
          case 'quantity':
            return recalcDiscount({ ...item, quantity: sanitizeInt(raw) });
          case 'discountPercent': {
            let pct = sanitizeDecimal(raw);
            if (Number(pct) > 100) pct = '100';
            return recalcDiscount({ ...item, discountPercent: pct, discountMode: 'percent' });
          }
          case 'discount':
            return recalcDiscount({ ...item, discount: sanitizeDecimal(raw), discountMode: 'amount' });
        }
      }),
    }));
    setItemErrors((e) => {
      if (!e[idx]) return e;
      const next = { ...e };
      delete next[idx];
      return next;
    });
  };

  const lineTotal = (item: FormItem) => price(item.productId) * (Number(item.quantity) || 0) - (Number(item.discount) || 0);
  const subtotal = round2(form.items.reduce((sum, item) => sum + (item.productId ? lineTotal(item) : 0), 0));
  const invoiceDiscount = Number(form.discount) || 0;
  const total = Math.max(0, round2(subtotal - invoiceDiscount));
  const paidValue = form.paidTouched ? form.paid : total.toString();
  const paid = Number(paidValue) || 0;
  const remaining = round2(total - paid);

  // Mirrors the backend rules in SalesInvoiceServiceImpl so the cashier
  // gets a specific Arabic message instead of a server error.
  const validate = (): { fields: FieldErrors; items: Record<number, string> } => {
    const fields: FieldErrors = {};
    const items: Record<number, string> = {};

    if (!branchIdNum) fields.branchId = 'لم يتم العثور على فرع نشط للمتجر';

    if (form.customerMode === 'existing') {
      if (!selectedCustomer) fields.customer = 'ابحث عن العميل واختره، أو اختر "عميل جديد"';
    } else {
      const name = form.customerName.trim();
      if (!name) fields.customerName = 'اسم العميل مطلوب';
      else if (name.length > MAX_NAME) fields.customerName = `الاسم يجب ألا يزيد عن ${MAX_NAME} حرف`;
      if (!phone) fields.customerPhone = 'رقم الهاتف مطلوب';
      else if (!isValidPhone(phone)) fields.customerPhone = 'رقم الهاتف يجب أن يتكون من 7 إلى 20 رقماً';
      // The backend would attach the sale to that customer and ignore the typed name.
      else if ((customers ?? []).some((c) => c.phone === phone)) fields.customerPhone = 'هذا الرقم مسجل لعميل حالي، اختره من "عميل حالي"';
      if (form.customerAddress.trim().length > MAX_ADDRESS) fields.customerAddress = `العنوان يجب ألا يزيد عن ${MAX_ADDRESS} حرف`;
    }
    if (form.notes.trim().length > MAX_NOTES) fields.notes = `الملاحظات يجب ألا تزيد عن ${MAX_NOTES} حرف`;

    const lines = form.items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.productId);
    if (lines.length === 0) fields.items = 'أضف منتجاً واحداً على الأقل';

    // Quantity requested per colour/size across all lines.
    const requested: Record<string, number> = {};
    for (const { item } of lines) {
      if (item.variantId) requested[item.variantId] = (requested[item.variantId] ?? 0) + (Number(item.quantity) || 0);
    }

    for (const { item, idx } of lines) {
      const qty = Number(item.quantity);
      const avail = available(item.variantId);
      const label = variantById[Number(item.variantId)]?.label;
      if (!item.variantId) items[idx] = 'اختر اللون/المقاس';
      else if (!Number.isInteger(qty) || qty <= 0) items[idx] = 'الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر';
      else if (price(item.productId) <= 0) items[idx] = 'المنتج ليس له سعر بيع فعّال';
      else if (requested[item.variantId] > avail) {
        items[idx] = requested[item.variantId] === qty
          ? `الكمية المطلوبة (${qty}) أكبر من المتاح من ${label} (${avail})`
          : `إجمالي الكمية من ${label} في الفاتورة (${requested[item.variantId]}) أكبر من المتاح (${avail})`;
      } else if (lineTotal(item) < 0) items[idx] = 'الخصم أكبر من إجمالي البند';
    }

    if (invoiceDiscount < 0) fields.discount = 'الخصم لا يمكن أن يكون سالباً';
    else if (invoiceDiscount > subtotal) fields.discount = 'خصم الفاتورة أكبر من إجمالي البنود';
    if (paidValue.trim() === '') fields.paid = 'أدخل المبلغ المدفوع';
    else if (paid > total) fields.paid = 'المدفوع لا يمكن أن يزيد عن إجمالي الفاتورة';

    return { fields, items };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (stocksError) {
      setError('تعذر تحميل المخزون. أعد المحاولة قبل إنشاء الفاتورة');
      return;
    }
    const { fields, items } = validate();
    setFieldErrors(fields);
    setItemErrors(items);
    if (Object.keys(fields).length > 0 || Object.keys(items).length > 0) {
      setError(fields.branchId ?? fields.items ?? 'يرجى تصحيح الحقول المحددة قبل الحفظ');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const created = await salesInvoicesService.create({
        branchId: branchIdNum!,
        customer: {
          name: form.customerMode === 'existing' && selectedCustomer ? selectedCustomer.name : form.customerName.trim(),
          phone: form.customerMode === 'existing' && selectedCustomer ? selectedCustomer.phone : phone,
          address: form.customerMode === 'existing' && selectedCustomer
            ? selectedCustomer.address || undefined
            : form.customerAddress.trim() || undefined,
        },
        paymentMethod: form.paymentMethod,
        items: form.items
          .filter((i) => i.productId)
          .map((i) => ({ variantId: Number(i.variantId), quantity: Number(i.quantity), discount: Number(i.discount) || 0 })),
        discount: invoiceDiscount,
        paid,
        notes: form.notes.trim() || undefined,
      });
      toast.success(`تم إنشاء فاتورة البيع ${created.invoiceNumber ?? ''} بنجاح`);
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['cash-closings-summary'] });
      setModalOpen(false);
      setViewing(created);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<SalesInvoice>[] = [
    { key: 'invoiceNumber', header: 'رقم الفاتورة', render: (inv) => <span className="font-mono text-sm font-medium" dir="ltr">{inv.invoiceNumber}</span> },
    { key: 'customer', header: 'العميل', render: (inv) => <span className="font-medium">{inv.customer?.name ?? '-'}</span> },
    { key: 'cashier', header: 'الكاشير', render: (inv) => inv.cashierName ?? '-' },
    { key: 'total', header: 'الإجمالي', render: (inv) => <span className="font-bold">{formatCurrency(inv.total)} ج.م</span> },
    { key: 'paid', header: 'المدفوع', render: (inv) => <span className="text-success font-medium">{formatCurrency(inv.paid)} ج.م</span> },
    { key: 'remaining', header: 'المتبقي', render: (inv) => <span className={inv.remaining && inv.remaining > 0 ? 'text-destructive font-medium' : ''}>{formatCurrency(inv.remaining)} ج.م</span> },
    { key: 'paymentMethod', header: 'الدفع', render: (inv) => <Badge variant="info">{getPaymentMethodLabel(inv.paymentMethod)}</Badge> },
    { key: 'createdAt', header: 'التاريخ', render: (inv) => <span className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</span> },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (inv) => <ActionButton onClick={() => setViewing(inv)} icon={Eye} label="عرض" />,
    },
  ];

  const inputCls = (err?: string) =>
    `h-10 px-2 rounded-lg border bg-background text-sm ${err ? 'border-destructive' : 'border-input'}`;

  return (
    <div>
      <PageHeader title="فواتير البيع" description="إدارة فواتير البيع للعملاء" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> فاتورة بيع جديدة
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث برقم الفاتورة أو اسم العميل أو الهاتف..." /></div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        error={queryError ? extractApiError(queryError).message : null}
        emptyTitle={search ? 'لا توجد نتائج مطابقة' : 'لا توجد فواتير بيع'}
        emptyDescription={search ? 'جرّب كلمة بحث أخرى' : 'ابدأ بإنشاء فاتورة بيع جديدة'}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="فاتورة بيع جديدة" maxWidth="max-w-4xl" persistent busy={loading}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <CustomerPicker
            customers={customers ?? []}
            loading={customersLoading}
            value={{ mode: form.customerMode, customerId: form.customerId, name: form.customerName, phone: form.customerPhone, address: form.customerAddress }}
            onChange={(v) => {
              setForm((f) => ({ ...f, customerMode: v.mode, customerId: v.customerId, customerName: v.name, customerPhone: v.phone, customerAddress: v.address }));
              setFieldErrors((e) => ({ ...e, customer: undefined, customerName: undefined, customerPhone: undefined, customerAddress: undefined }));
            }}
            errors={{ customer: fieldErrors.customer, name: fieldErrors.customerName, phone: fieldErrors.customerPhone, address: fieldErrors.customerAddress }}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">المنتجات</label>
              <input
                type="text"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addByCode(); } }}
                placeholder={scanning ? 'جاري البحث...' : 'امسح الباركود أو اكتب الكود ثم Enter'}
                aria-label="إضافة بالكود أو الباركود"
                disabled={!branchIdNum || scanning}
                className="flex-1 max-w-xs mx-3 h-9 px-3 rounded-lg border border-input bg-background text-sm"
                dir="ltr"
              />
              <button type="button" onClick={addItem} disabled={!branchIdNum} className="flex items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50 disabled:no-underline"><Plus className="w-4 h-4" /> إضافة منتج</button>
            </div>

            {!branchIdNum ? (
              branchLoading
                ? <p className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">جاري التحميل...</p>
                : <FormError message="لم يتم العثور على فرع نشط للمتجر. تواصل مع مدير النظام." />
            ) : stocksLoading ? (
              <p className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">جاري تحميل المخزون...</p>
            ) : stocksError ? (
              <FormError message={`تعذر تحميل المخزون: ${extractApiError(stocksError).message}`} />
            ) : sellableProducts.length === 0 && form.items.every((i) => !i.productId) ? (
              <p className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-foreground">لا توجد منتجات متاحة للبيع (مخزون أو سعر بيع غير متوفر).</p>
            ) : (
              <div className="space-y-3">
                {form.items.map((item, idx) => {
                  const options = sellableProducts.some((p) => String(p.id) === item.productId) || !item.productId
                    ? sellableProducts
                    : [...sellableProducts, ...(products ?? []).filter((p) => String(p.id) === item.productId)];
                  return (
                    <div key={item.key} className="p-3 rounded-lg border space-y-2">
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[180px] flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">المنتج</label>
                          <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} aria-label="المنتج" className={`w-full ${inputCls(itemErrors[idx])}`}>
                            <option value="">اختر منتج</option>
                            {options.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code ? `${p.code} - ` : ''}{p.name} (متاح: {availableByProduct[p.id] ?? 0})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="min-w-[150px] flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">اللون / المقاس</label>
                          <select value={item.variantId} onChange={(e) => updateItem(idx, 'variantId', e.target.value)} disabled={!item.productId} aria-label="اللون والمقاس" className={`w-full ${inputCls(itemErrors[idx] && !item.variantId ? itemErrors[idx] : undefined)} disabled:bg-muted/30`}>
                            <option value="">اختر</option>
                            {(item.variantId && !sellableVariants(item.productId).some((v) => String(v.id) === item.variantId)
                              ? [...sellableVariants(item.productId), ...((products ?? []).find((p) => String(p.id) === item.productId)?.variants.filter((v) => String(v.id) === item.variantId) ?? [])]
                              : sellableVariants(item.productId)
                            ).map((v) => (
                              <option key={v.id} value={v.id}>{v.label} (متاح: {v.quantity})</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">المتاح</label>
                          <div className="w-16 h-10 px-2 flex items-center rounded-lg border border-input bg-muted/30 text-sm" dir="ltr">{item.variantId ? available(item.variantId) : '-'}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">الكمية</label>
                          <input type="text" inputMode="numeric" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} aria-label="الكمية" className={`w-20 ${inputCls(itemErrors[idx])}`} dir="ltr" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">سعر الوحدة</label>
                          <div className="w-24 h-10 px-2 flex items-center rounded-lg border border-input bg-muted/30 text-sm" dir="ltr">{item.productId ? formatCurrency(price(item.productId)) : '-'}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">خصم %</label>
                          <input type="text" inputMode="decimal" value={item.discountPercent} onChange={(e) => updateItem(idx, 'discountPercent', e.target.value)} aria-label="نسبة الخصم" className={`w-20 ${inputCls()}`} dir="ltr" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">قيمة الخصم (ج.م)</label>
                          <input type="text" inputMode="decimal" value={item.discount} onChange={(e) => updateItem(idx, 'discount', e.target.value)} aria-label="قيمة الخصم" className={`w-24 ${inputCls()}`} dir="ltr" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">إجمالي البند</label>
                          <div className="w-28 h-10 px-2 flex items-center rounded-lg bg-primary/5 border border-primary/20 text-sm font-bold text-primary" dir="ltr">{item.productId ? formatCurrency(lineTotal(item)) : '-'}</div>
                        </div>
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} aria-label="حذف البند" className="p-2.5 rounded-lg text-destructive hover:bg-destructive/10"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                      {itemErrors[idx] && <p className="text-xs text-destructive">{itemErrors[idx]}</p>}
                    </div>
                  );
                })}
              </div>
            )}
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

          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-sm text-muted-foreground">
              إجمالي البنود: <span className="font-medium text-foreground">{formatCurrency(subtotal)} ج.م</span>
              {invoiceDiscount > 0 && <> · خصم الفاتورة: <span className="font-medium text-foreground">{formatCurrency(invoiceDiscount)} ج.م</span></>}
            </div>
            <div className="text-lg font-bold text-primary">الإجمالي: {formatCurrency(total)} ج.م</div>
          </div>
          {form.paidTouched && (
            <button type="button" onClick={() => setForm({ ...form, paid: '', paidTouched: false })} className="text-xs text-primary hover:underline">
              اجعل المدفوع = الإجمالي
            </button>
          )}

          <FormTextarea label="ملاحظات" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="ملاحظات الفاتورة" maxLength={MAX_NOTES} error={fieldErrors.notes} />

          <p className="text-xs text-muted-foreground">الأسعار تُحسب من سعر البيع الحالي على الخادم، ويتم تسجيل الكاشير تلقائياً من حسابك.</p>

          <FormError message={error} />
          <SubmitButton loading={loading} label="إنشاء الفاتورة" />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`فاتورة بيع - ${viewing?.invoiceNumber ?? ''}`} maxWidth="max-w-2xl">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">العميل</p><p className="text-sm font-medium">{viewing.customer?.name ?? '-'}</p>{viewing.customer?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{viewing.customer.phone}</p>}</div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الكاشير</p><p className="text-sm font-medium">{viewing.cashierName ?? '-'}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">طريقة الدفع</p><Badge variant="info">{getPaymentMethodLabel(viewing.paymentMethod)}</Badge></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">خصم الفاتورة</p><p className="font-bold">{formatCurrency(viewing.discount)} ج.م</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">الإجمالي</p><p className="font-bold">{formatCurrency(viewing.total)} ج.م</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المدفوع</p><p className="text-success font-bold">{formatCurrency(viewing.paid)} ج.م</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المتبقي</p><p className={viewing.remaining && viewing.remaining > 0 ? 'text-destructive font-bold' : 'font-bold'}>{formatCurrency(viewing.remaining)} ج.م</p></div>
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
                    <span className="text-sm font-bold">{formatCurrency(item.total)} ج.م</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">التاريخ: {formatDate(viewing.createdAt)}</p>
            {viewing.notes && <div><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-sm">{viewing.notes}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

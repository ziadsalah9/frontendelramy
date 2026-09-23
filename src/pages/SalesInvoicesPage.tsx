import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Receipt, X } from 'lucide-react';
import { salesInvoicesService } from '@/api/salesInvoices';
import { branchesService } from '@/api/branches';
import { productsService } from '@/api/products';
import { productPricesService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { SalesInvoice, PaymentMethod } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { formatDate, formatCurrency, getPaymentMethodLabel } from '@/utils/format';
import { toast } from 'sonner';

interface FormItem { productId: string; quantity: string; discount: string; }

export default function SalesInvoicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<SalesInvoice | null>(null);
  const [form, setForm] = useState({ branchId: '', customerName: '', customerPhone: '', customerAddress: '', paymentMethod: 'CASH' as PaymentMethod, discount: '0', paid: '0', notes: '', items: [{ productId: '', quantity: '', discount: '0' }] as FormItem[] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: invoices, isLoading, error: queryError } = useQuery({ queryKey: ['sales-invoices'], queryFn: salesInvoicesService.getAll });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const filtered = (invoices ?? []).filter((inv) => inv.invoiceNumber.includes(search) || (inv.customerName ?? '').includes(search));

  const openCreate = () => {
    setForm({ branchId: '', customerName: '', customerPhone: '', customerAddress: '', paymentMethod: 'CASH', discount: '0', paid: '0', notes: '', items: [{ productId: '', quantity: '', discount: '0' }] });
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: '', quantity: '', discount: '0' }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  const updateItem = (idx: number, field: keyof FormItem, value: string) => {
    const items = form.items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setForm({ ...form, items });
  };

  // Calculate estimated total using product prices
  const [priceCache, setPriceCache] = useState<Record<number, number>>({});
  const fetchPrice = async (productId: number) => {
    if (priceCache[productId] !== undefined) return;
    try {
      const price = await productPricesService.getPrice(productId);
      setPriceCache((prev) => ({ ...prev, [productId]: price.sellingPrice }));
    } catch { /* ignore */ }
  };

  const calcTotal = () => {
    return form.items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const disc = Number(item.discount) || 0;
      const price = item.productId ? (priceCache[Number(item.productId)] ?? 0) : 0;
      if (item.productId) fetchPrice(Number(item.productId));
      return sum + qty * price - disc;
    }, 0) - (Number(form.discount) || 0);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await salesInvoicesService.create({
        branchId: Number(form.branchId),
        customer: { name: form.customerName, phone: form.customerPhone, address: form.customerAddress || undefined },
        paymentMethod: form.paymentMethod,
        items: form.items.filter((i) => i.productId && i.quantity).map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity), discount: Number(i.discount) || 0 })),
        discount: Number(form.discount) || 0,
        paid: Number(form.paid) || 0,
        notes: form.notes || undefined,
      });
      toast.success('تم إنشاء فاتورة البيع بنجاح');
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<SalesInvoice>[] = [
    { key: 'invoiceNumber', header: 'رقم الفاتورة', render: (inv) => <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span> },
    { key: 'customer', header: 'العميل', render: (inv) => <span className="font-medium">{inv.customerName ?? '-'}</span> },
    { key: 'branch', header: 'الفرع', render: (inv) => branches?.find((b) => b.id === inv.branchId)?.name ?? `#${inv.branchId}` },
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

  return (
    <div>
      <PageHeader title="فواتير البيع" description="إدارة فواتير البيع للعملاء" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> فاتورة بيع جديدة
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث برقم الفاتورة أو اسم العميل..." /></div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا توجد فواتير بيع" emptyDescription="ابدأ بإنشاء فاتورة بيع جديدة" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="فاتورة بيع جديدة" maxWidth="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect label="الفرع" value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} required placeholder="اختر الفرع" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
            <FormInput label="اسم العميل" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} required placeholder="اسم العميل" />
            <FormInput label="هاتف العميل" value={form.customerPhone} onChange={(v) => setForm({ ...form, customerPhone: v })} required placeholder="رقم الهاتف" dir="ltr" />
            <FormInput label="العنوان" value={form.customerAddress} onChange={(v) => setForm({ ...form, customerAddress: v })} placeholder="العنوان" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">المنتجات</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="w-4 h-4" /> إضافة منتج</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} required className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm">
                    <option value="">اختر منتج</option>
                    {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} - {p.itemType ?? ''} {p.color ?? ''}</option>)}
                  </select>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} required placeholder="الكمية" className="w-24 h-10 px-3 rounded-lg border border-input bg-background text-sm" dir="ltr" />
                  <input type="number" value={item.discount} onChange={(e) => updateItem(idx, 'discount', e.target.value)} placeholder="خصم" className="w-20 h-10 px-3 rounded-lg border border-input bg-background text-sm" dir="ltr" />
                  {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="p-2.5 rounded-lg text-destructive hover:bg-destructive/10"><X className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormInput label="خصم الفاتورة" type="number" value={form.discount} onChange={(v) => setForm({ ...form, discount: v })} dir="ltr" />
            <FormInput label="المدفوع" type="number" value={form.paid} onChange={(v) => setForm({ ...form, paid: v })} dir="ltr" />
            <FormSelect label="طريقة الدفع" value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })} options={[{ value: 'CASH', label: 'نقدي' }, { value: 'CARD', label: 'بطاقة' }, { value: 'TRANSFER', label: 'تحويل' }, { value: 'CREDIT', label: 'آجل' }]} />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">الإجمالي (تقديري)</label>
              <div className="h-10 px-3 flex items-center rounded-lg bg-primary/5 border border-primary/20 text-primary font-bold text-sm">{formatCurrency(calcTotal())} ج.م</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
            ملاحظة: يتم تحديد الكاشير تلقائياً من قبل الخادم بناءً على حسابك الحالي
          </div>

          <FormTextarea label="ملاحظات" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="ملاحظات الفاتورة" />
          <SubmitButton loading={loading} label="إنشاء الفاتورة" />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`فاتورة بيع - ${viewing?.invoiceNumber ?? ''}`} maxWidth="max-w-2xl">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">العميل</p><p className="text-sm font-medium">{viewing.customerName ?? '-'}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الكاشير</p><p className="text-sm font-medium">{viewing.cashierName ?? '-'}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الفرع</p><p className="text-sm font-medium">{branches?.find((b) => b.id === viewing.branchId)?.name ?? '-'}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">طريقة الدفع</p><Badge variant="info">{getPaymentMethodLabel(viewing.paymentMethod)}</Badge></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">الإجمالي</p><p className="font-bold">{formatCurrency(viewing.total)} ج.م</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المدفوع</p><p className="text-success font-bold">{formatCurrency(viewing.paid)} ج.م</p></div>
              <div className="p-3 rounded-lg border"><p className="text-xs text-muted-foreground mb-1">المتبقي</p><p className={viewing.remaining && viewing.remaining > 0 ? 'text-destructive font-bold' : 'font-bold'}>{formatCurrency(viewing.remaining)} ج.م</p></div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">المنتجات</h4>
              <div className="space-y-2">
                {viewing.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div><p className="text-sm font-medium">{products?.find((p) => p.id === item.productId)?.name ?? `#${item.productId}`}</p><p className="text-xs text-muted-foreground">{item.quantity} وحدة - خصم: {formatCurrency(item.discount)} ج.م</p></div>
                    <span className="text-sm font-bold">{formatCurrency(item.total)} ج.م</span>
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

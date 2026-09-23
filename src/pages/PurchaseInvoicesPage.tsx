import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, ShoppingCart, X, Trash2 } from 'lucide-react';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { branchesService } from '@/api/branches';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { PurchaseInvoice, PaymentMethod } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { formatDate, formatCurrency, getPaymentMethodLabel } from '@/utils/format';
import { toast } from 'sonner';

interface FormItem { productId: string; quantity: string; unitPrice: string; discount: string; }

export default function PurchaseInvoicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<PurchaseInvoice | null>(null);
  const [form, setForm] = useState({ invoiceNumber: '', branchId: '', discount: '0', paid: '0', paymentMethod: 'CASH' as PaymentMethod, notes: '', items: [{ productId: '', quantity: '', unitPrice: '0', discount: '0' }] as FormItem[] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: invoices, isLoading, error: queryError } = useQuery({ queryKey: ['purchase-invoices'], queryFn: purchaseInvoicesService.getAll });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const filtered = (invoices ?? []).filter((inv) => inv.invoiceNumber.includes(search));

  const openCreate = () => {
    setForm({ invoiceNumber: '', branchId: '', discount: '0', paid: '0', paymentMethod: 'CASH', notes: '', items: [{ productId: '', quantity: '', unitPrice: '0', discount: '0' }] });
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: '', quantity: '', unitPrice: '0', discount: '0' }] });
  const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  const updateItem = (idx: number, field: keyof FormItem, value: string) => {
    const items = form.items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setForm({ ...form, items });
  };

  const calcTotal = () => {
    const itemsTotal = form.items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      return sum + qty * price - disc;
    }, 0);
    return itemsTotal - (Number(form.discount) || 0);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await purchaseInvoicesService.create({
        invoiceNumber: form.invoiceNumber,
        branchId: Number(form.branchId),
        items: form.items.filter((i) => i.productId && i.quantity).map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount) || 0 })),
        discount: Number(form.discount) || 0,
        paid: Number(form.paid) || 0,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
      });
      toast.success('تم إنشاء فاتورة الشراء بنجاح');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      setModalOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<PurchaseInvoice>[] = [
    { key: 'invoiceNumber', header: 'رقم الفاتورة', render: (inv) => <span className="font-mono text-sm font-medium">{inv.invoiceNumber}</span> },
    { key: 'branch', header: 'الفرع', render: (inv) => branches?.find((b) => b.id === inv.branchId)?.name ?? `#${inv.branchId}` },
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

  return (
    <div>
      <PageHeader title="فواتير الشراء" description="إدارة فواتير الشراء من الموردين" action={
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> فاتورة شراء جديدة
        </button>
      } />

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث برقم الفاتورة..." /></div>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

      <DataTable columns={columns} data={filtered} loading={isLoading} error={queryError ? extractApiError(queryError).message : null} emptyTitle="لا توجد فواتير شراء" emptyDescription="ابدأ بإنشاء فاتورة شراء جديدة" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="فاتورة شراء جديدة" maxWidth="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="رقم الفاتورة" value={form.invoiceNumber} onChange={(v) => setForm({ ...form, invoiceNumber: v })} required placeholder="PUR-2026-0001" dir="ltr" />
            <FormSelect label="الفرع" value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} required placeholder="اختر الفرع" options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">المنتجات</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-primary hover:underline"><Plus className="w-4 h-4" /> إضافة منتج</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                  <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} required className="flex-1 min-w-[140px] h-10 px-3 rounded-lg border border-input bg-background text-sm">
                    <option value="">اختر منتج</option>
                    {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} required placeholder="الكمية" className="w-24 h-10 px-3 rounded-lg border border-input bg-background text-sm" dir="ltr" />
                  <input type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} required placeholder="سعر الوحدة" className="w-28 h-10 px-3 rounded-lg border border-input bg-background text-sm" dir="ltr" />
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

          <FormTextarea label="ملاحظات" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="ملاحظات الفاتورة" />
          <SubmitButton loading={loading} label="إنشاء الفاتورة" />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`فاتورة شراء - ${viewing?.invoiceNumber ?? ''}`} maxWidth="max-w-2xl">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الفرع</p><p className="text-sm font-medium">{branches?.find((b) => b.id === viewing.branchId)?.name ?? '-'}</p></div>
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
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div><p className="text-sm font-medium">{products?.find((p) => p.id === item.productId)?.name ?? `#${item.productId}`}</p><p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unitPrice)} ج.م</p></div>
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

import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Eye, Trash2, Package, FileSpreadsheet, Boxes, Tags } from 'lucide-react';
import { productsService, productPricesService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { Product, ProductType, ProductPriceUpdateInput } from '@/types';
import { PRODUCT_TYPES } from '@/types';
import { VariantsEditor } from '@/components/products/VariantsEditor';
import { FormSection } from '@/components/products/FormSection';
import { newVariantRow, duplicateVariantError, overTotalError, type VariantRow } from '@/utils/variants';
import { PageHeader, ConfirmDialog } from '@/components/shared/States';
import { formatCurrency } from '@/utils/format';
import { sanitizeDecimal, sanitizeInt, matches, MAX_NAME, MAX_MODEL } from '@/utils/validation';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormError, SubmitButton } from '@/components/shared/Modal';
import { useAuth } from '@/hooks/useAuth';
import { reprice, round2 } from '@/utils/pricing';
import { ProductImportDialog } from '@/components/products/ProductImportDialog';
import { toast } from 'sonner';

interface ProductForm {
  name: string;
  type: ProductType | '';
  model: string;
  minimumQuantity: string;
  basePrice: string;
  profitPercent: string;
  sellingPrice: string;
  /** Total available quantity; colours/sizes may add up to at most this. */
  totalQuantity: string;
}

type FieldErrors = Partial<Record<keyof ProductForm | 'variants', string>>;

const emptyForm: ProductForm = {
  name: '',
  type: '',
  model: '',
  minimumQuantity: '0',
  basePrice: '',
  profitPercent: '',
  sellingPrice: '',
  totalQuantity: '',
};


/** Distinct non-empty values as small chips ("-" when none). */
function Chips({ values }: { values: (string | null | undefined)[] }) {
  const unique = [...new Set(values.filter((v): v is string => !!v && v.trim() !== ''))];
  if (unique.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1 max-w-[220px]">
      {unique.map((v) => <span key={v} className="px-1.5 py-0.5 rounded bg-muted text-xs">{v}</span>)}
    </div>
  );
}

/** One labelled value in the product details dialog. */
function Field({ label, children, ltr }: { label: string; children: ReactNode; ltr?: boolean }) {
  return (
    <div className="p-3 rounded-lg border">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-medium" dir={ltr ? 'ltr' : undefined}>{children}</div>
    </div>
  );
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  // POST/PUT/DELETE /api/products and the price endpoints are ADMIN-only.
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  // Which price field the user typed last decides what is sent: the
  // backend rejects a request carrying both sellingPrice and profitPercentage.
  const [priceSource, setPriceSource] = useState<'profit' | 'selling'>('profit');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [lossConfirmOpen, setLossConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: products, isLoading, error: queryError } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const filtered = (products ?? []).filter((p) =>
    matches(p.name, search) ||
    matches(p.code, search) ||
    matches(p.model, search) ||
    matches(p.itemType, search) ||
    p.variants.some((v) => matches(v.code, search) || matches(v.barcode, search) || matches(v.color, search) || matches(v.size, search))
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setVariantRows([newVariantRow()]);
    setPriceSource('profit');
    setFieldErrors({});
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.itemType ?? '',
      model: p.model ?? '',
      minimumQuantity: String(p.minimumQuantity ?? 0),
      basePrice: p.currentPrice ? String(p.currentPrice.purchasePrice) : '',
      profitPercent: p.currentPrice?.profitPercentage != null ? String(p.currentPrice.profitPercentage) : '',
      sellingPrice: p.currentPrice ? String(p.currentPrice.sellingPrice) : '',
      totalQuantity: String(p.quantity ?? p.variants.reduce((sum, v) => sum + (v.quantity ?? 0), 0)),
    });
    setVariantRows(p.variants.map((v) => ({
      key: `v-${v.id}`, id: v.id, color: v.color ?? '', size: v.size ?? '', code: v.code, quantity: v.quantity, qty: String(v.quantity ?? 0),
    })));
    setPriceSource(p.currentPrice && p.currentPrice.profitPercentage == null ? 'selling' : 'profit');
    setFieldErrors({});
    setError('');
    setModalOpen(true);
  };

  const onPriceFieldChange = (field: 'basePrice' | 'profitPercent' | 'sellingPrice', raw: string) => {
    const value = sanitizeDecimal(raw);
    const anchor = field === 'profitPercent' ? 'profit' : field === 'sellingPrice' ? 'selling' : priceSource;
    setPriceSource(anchor);
    setForm((f) => reprice({ ...f, [field]: value }, anchor));
    setFieldErrors((e) => ({ ...e, basePrice: undefined, profitPercent: undefined, sellingPrice: undefined }));
  };

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    const name = form.name.trim();
    if (!name) errs.name = 'اسم المنتج مطلوب';
    else if (name.length > MAX_NAME) errs.name = `الاسم يجب ألا يزيد عن ${MAX_NAME} حرف`;
    if (!form.type) errs.type = 'اختر النوع';
    const dup = duplicateVariantError(variantRows);
    if (dup) errs.variants = dup;
    else if (variantRows.length === 0) errs.variants = 'أضف لوناً/مقاساً واحداً على الأقل';
    if (form.totalQuantity === '') errs.totalQuantity = 'إجمالي الكمية مطلوب (0 مقبول)';
    else {
      const over = overTotalError(variantRows, form.totalQuantity);
      if (over) errs.variants = over;
    }
    if (form.model.trim().length > MAX_MODEL) errs.model = `الموديل يجب ألا يزيد عن ${MAX_MODEL} حرف`;
    if (form.minimumQuantity === '' || !Number.isInteger(Number(form.minimumQuantity))) {
      errs.minimumQuantity = 'الحد الأدنى يجب أن يكون رقماً صحيحاً (0 أو أكثر)';
    }
    if (!(Number(form.basePrice) > 0)) errs.basePrice = 'سعر التكلفة يجب أن يكون أكبر من صفر';
    else if (priceSource === 'profit' && form.profitPercent === '') errs.profitPercent = 'أدخل نسبة الربح أو سعر البيع';
    else if (!(Number(form.sellingPrice) > 0)) errs.sellingPrice = 'سعر البيع يجب أن يكون أكبر من صفر';
    return errs;
  };

  /** True when the price fields differ from the product's current price. */
  const priceChanged = (p: Product | null): boolean => {
    const current = p?.currentPrice;
    if (!current) return true;
    return (
      round2(Number(form.basePrice)) !== round2(current.purchasePrice) ||
      round2(Number(form.sellingPrice)) !== round2(current.sellingPrice)
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError('يرجى تصحيح الحقول المحددة');
      return;
    }
    setError('');
    if (Number(form.sellingPrice) < Number(form.basePrice)) {
      setLossConfirmOpen(true);
      return;
    }
    void save();
  };

  const save = async () => {
    setLossConfirmOpen(false);
    setLoading(true);
    setError('');

    // Step 1: the product itself. After a successful create, `editing`
    // becomes the new product so that a retry (e.g. after the price step
    // failed) updates it instead of creating a duplicate.
    let product: Product;
    // New product: always. Edit: only when the total or a quantity changed,
    // so renaming a product never conflicts with a sale made meanwhile.
    const quantitiesTouched = !editing
      || form.totalQuantity !== String(editing.quantity ?? 0)
      || variantRows.some((r) => r.id == null ? r.qty !== '' : r.qty !== '' && r.qty !== String(r.quantity ?? 0));
    const payload = {
      name: form.name.trim(),
      itemType: form.type as ProductType,
      model: form.model.trim() || undefined,
      minimumQuantity: Number(form.minimumQuantity),
      // The full list: rows removed in the form are removed (or deactivated) on the server.
      variants: variantRows.map((r) => {
        // Unchanged (or empty) = leave the stock alone, so a sale made while
        // the form was open is not undone. When quantities or the total were
        // touched, every saved row carries the stock the form showed, and the
        // server rejects the save if anything moved since.
        const untouched = r.qty === '' || (r.id != null && r.qty === String(r.quantity ?? 0));
        return {
          id: r.id, color: r.color || null, size: r.size || null,
          quantity: untouched ? null : Number(r.qty),
          expectedQuantity: r.id == null || (untouched && !quantitiesTouched) ? null : r.quantity ?? 0,
        };
      }),
      // The server keeps what the colours/sizes leave of it as "no colour or size".
      totalQuantity: quantitiesTouched ? Number(form.totalQuantity) : undefined,
    };
    try {
      if (editing) {
        product = await productsService.update(editing.id, payload);
        // The update response may not carry the price; keep the one we know.
        product = { ...product, currentPrice: product.currentPrice ?? editing.currentPrice };
      } else {
        product = await productsService.create(payload);
      }
      setEditing(product);
    } catch (err) {
      setError(extractApiError(err).message);
      setLoading(false);
      return;
    }

    // Step 2: the price, only when it actually changed (every write adds a
    // price-history row).
    if (priceChanged(product)) {
      const priceInput: ProductPriceUpdateInput =
        priceSource === 'profit' && form.profitPercent !== '' && Number(form.profitPercent) >= 0
          ? { purchasePrice: Number(form.basePrice), profitPercentage: Number(form.profitPercent) }
          : { purchasePrice: Number(form.basePrice), sellingPrice: Number(form.sellingPrice) };
      try {
        const updated = await productPricesService.setPrice(product.id, priceInput);
        setEditing(updated);
      } catch (err) {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setError(`تم حفظ بيانات المنتج، لكن تعذر حفظ السعر: ${extractApiError(err).message}`);
        setLoading(false);
        return;
      }
    }

    toast.success(editing ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    setLoading(false);
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await productsService.delete(deleteTarget.id);
      toast.success('تم تعطيل المنتج بنجاح');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // A disabled product no longer counts towards low stock.
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  // The table stays scannable: identity + selling price + actions. Cost,
  // profit, stock, limits and status live in the details dialog (eye).
  const columns: Column<Product>[] = [
    { key: 'name', header: 'الاسم', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'type', header: 'النوع', render: (p) => p.itemType ? <Badge variant="info">{p.itemType}</Badge> : '-' },
    { key: 'color', header: 'اللون', render: (p) => <Chips values={p.variants.map((v) => v.color)} /> },
    { key: 'size', header: 'المقاس', render: (p) => <Chips values={p.variants.map((v) => v.size)} /> },
    {
      key: 'sellingPrice', header: 'سعر البيع',
      render: (p) => p.currentPrice
        ? <span className="font-semibold text-primary whitespace-nowrap">{formatCurrency(p.currentPrice.sellingPrice)} ج.م</span>
        : <Badge variant="warning">بدون سعر</Badge>,
    },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left w-px',
      render: (p) => (
        <div className="flex items-center gap-1">
          <ActionButton onClick={() => setViewing(p)} icon={Eye} label="عرض التفاصيل" />
          {isAdmin && <ActionButton onClick={() => openEdit(p)} icon={Edit2} label="تعديل" />}
          {isAdmin && p.active !== false && (
            <ActionButton onClick={() => setDeleteTarget(p)} icon={Trash2} label="تعطيل" variant="destructive" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="المنتجات" description="إدارة منتجات المتجر" action={
        isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-all">
              <FileSpreadsheet className="w-4 h-4" /> استيراد من Excel
            </button>
            <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all">
              <Plus className="w-4 h-4" /> إضافة منتج
            </button>
          </div>
        ) : undefined
      } />

      {isAdmin && <ProductImportDialog open={importOpen} onClose={() => setImportOpen(false)} />}

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود أو النوع أو اللون..." /></div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        error={queryError ? extractApiError(queryError).message : null}
        emptyTitle={search ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات'}
        emptyDescription={search ? 'جرّب كلمة بحث أخرى' : isAdmin ? 'ابدأ بإضافة منتج جديد' : undefined}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل منتج' : 'إضافة منتج جديد'} maxWidth="max-w-3xl" persistent busy={loading}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormError message={error} />

          <FormSection icon={Package} title="البيانات الأساسية">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="اسم المنتج" maxLength={MAX_NAME} error={fieldErrors.name} />
              <FormSelect
                label="النوع"
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v as ProductType })}
                options={PRODUCT_TYPES}
                required
                placeholder="اختر النوع"
                error={fieldErrors.type}
              />
              <FormInput label="الموديل" value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="اختياري" maxLength={MAX_MODEL} error={fieldErrors.model} />
              <FormInput label="الحد الأدنى للكمية (تنبيه)" type="text" inputMode="numeric" value={form.minimumQuantity} onChange={(v) => setForm({ ...form, minimumQuantity: sanitizeInt(v) })} required dir="ltr" error={fieldErrors.minimumQuantity} />
            </div>
          </FormSection>

          <FormSection icon={Boxes} title="الكمية والألوان والمقاسات" hint="اكتب إجمالي الكمية ثم وزّعها. كل لون/مقاس له كوده وباركوده، والسعر واحد للجميع.">
            <VariantsEditor
              rows={variantRows}
              onChange={(rows) => { setVariantRows(rows); setFieldErrors((e) => ({ ...e, variants: undefined })); }}
              total={form.totalQuantity}
              onTotalChange={(v) => { setForm({ ...form, totalQuantity: v }); setFieldErrors((e) => ({ ...e, totalQuantity: undefined, variants: undefined })); }}
              totalError={fieldErrors.totalQuantity}
              error={fieldErrors.variants}
            />
          </FormSection>

          <FormSection icon={Tags} title="التسعير" hint="أدخل سعر التكلفة ثم نسبة الربح أو سعر البيع، ويُحسب الآخر تلقائياً.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormInput label="سعر التكلفة" type="text" inputMode="decimal" value={form.basePrice} onChange={(v) => onPriceFieldChange('basePrice', v)} required placeholder="0.00" dir="ltr" error={fieldErrors.basePrice} />
              <FormInput
                label={priceSource === 'selling' ? 'نسبة الربح % (محسوبة)' : 'نسبة الربح %'}
                type="text"
                inputMode="decimal"
                value={form.profitPercent}
                onChange={(v) => onPriceFieldChange('profitPercent', v)}
                placeholder="مثال: 30"
                dir="ltr"
                error={fieldErrors.profitPercent}
              />
              <FormInput
                label={priceSource === 'profit' ? 'سعر البيع (محسوب)' : 'سعر البيع'}
                type="text"
                inputMode="decimal"
                value={form.sellingPrice}
                onChange={(v) => onPriceFieldChange('sellingPrice', v)}
                required
                placeholder="0.00"
                dir="ltr"
                error={fieldErrors.sellingPrice}
              />
            </div>
            {Number(form.basePrice) > 0 && Number(form.sellingPrice) > 0 && (
              <p className={`text-sm ${Number(form.sellingPrice) < Number(form.basePrice) ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                الربح للوحدة: <span className="font-semibold">{formatCurrency(round2(Number(form.sellingPrice) - Number(form.basePrice)))} ج.م</span>
                {Number(form.sellingPrice) < Number(form.basePrice) && ' (سعر البيع أقل من سعر التكلفة)'}
              </p>
            )}
          </FormSection>

          <SubmitButton loading={loading} label={editing ? 'حفظ التغييرات' : 'إضافة'} />
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="تفاصيل المنتج" maxWidth="max-w-2xl">
        {viewing && (() => {
          const price = viewing.currentPrice;
          const qty = viewing.quantity ?? 0;
          const min = viewing.minimumQuantity ?? 0;
          const stockState = qty <= 0 ? { label: 'نفد', variant: 'destructive' as const }
            : min > 0 && qty <= min ? { label: 'منخفض', variant: 'warning' as const }
            : { label: 'متوفر', variant: 'success' as const };
          return (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{viewing.name}</p>
                  <p className="text-sm text-muted-foreground">{[viewing.itemType, `${viewing.variants.length} لون/مقاس`].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge variant={viewing.active === false ? 'destructive' : 'success'}>{viewing.active === false ? 'غير نشط' : 'نشط'}</Badge>
              </div>

              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2">البيانات الأساسية</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="كود المنتج" ltr><span className="font-mono">{viewing.code || '-'}</span></Field>
                  <Field label="الموديل">{viewing.model || '-'}</Field>
                  <Field label="النوع">{viewing.itemType || '-'}</Field>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2">التسعير</h4>
                {price ? (
                  // Cost and profit are ADMIN-only (the API doesn't send them to employees).
                  isAdmin ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Field label="سعر التكلفة">{formatCurrency(price.purchasePrice)} ج.م</Field>
                      <Field label="نسبة الربح">{price.profitPercentage != null ? `${formatCurrency(price.profitPercentage)}%` : '-'}</Field>
                      <Field label="سعر البيع"><span className="text-primary font-bold">{formatCurrency(price.sellingPrice)} ج.م</span></Field>
                      <Field label="الربح للوحدة">
                        <span className={price.sellingPrice < price.purchasePrice ? 'text-destructive' : 'text-success'}>
                          {formatCurrency(price.sellingPrice - price.purchasePrice)} ج.م
                        </span>
                      </Field>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="سعر البيع"><span className="text-primary font-bold">{formatCurrency(price.sellingPrice)} ج.م</span></Field>
                    </div>
                  )
                ) : (
                  <p className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-foreground">لا يوجد سعر مسجل لهذا المنتج، ولن يظهر في فواتير البيع حتى يتم تسعيره.</p>
                )}
              </section>

              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2">المخزون</h4>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="الكمية المتاحة"><span className="text-lg font-bold">{qty}</span></Field>
                  <Field label="الحد الأدنى">{min}</Field>
                  <Field label="حالة المخزون"><Badge variant={stockState.variant}>{stockState.label}</Badge></Field>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2">الألوان والمقاسات ({viewing.variants.length})</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-right p-2 font-medium">اللون</th>
                        <th className="text-right p-2 font-medium">المقاس</th>
                        <th className="text-right p-2 font-medium">الكود</th>
                        <th className="text-right p-2 font-medium">الباركود</th>
                        <th className="text-left p-2 font-medium">الكمية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewing.variants.map((v) => (
                        <tr key={v.id} className="border-t">
                          <td className="p-2">{v.color || <span className="text-muted-foreground">-</span>}</td>
                          <td className="p-2">{v.size || <span className="text-muted-foreground">-</span>}</td>
                          <td className="p-2 font-mono text-xs" dir="ltr">{v.code}</td>
                          <td className="p-2 font-mono text-xs" dir="ltr">{v.barcode || '-'}</td>
                          <td className={`p-2 text-left font-bold ${v.quantity <= 0 ? 'text-destructive' : ''}`}>{v.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {isAdmin && (
                <div className="flex justify-end gap-2 pt-2 border-t">
                  {viewing.active !== false && (
                    <button type="button" onClick={() => { setDeleteTarget(viewing); setViewing(null); }} className="flex items-center gap-2 h-10 px-4 rounded-lg border border-destructive/40 text-destructive text-sm hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" /> تعطيل
                    </button>
                  )}
                  <button type="button" onClick={() => { openEdit(viewing); setViewing(null); }} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
                    <Edit2 className="w-4 h-4" /> تعديل
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog
        open={lossConfirmOpen}
        onConfirm={() => void save()}
        onCancel={() => setLossConfirmOpen(false)}
        title="سعر البيع أقل من التكلفة"
        description={`سعر البيع (${formatCurrency(Number(form.sellingPrice))} ج.م) أقل من سعر التكلفة (${formatCurrency(Number(form.basePrice))} ج.م). هل تريد الحفظ على أي حال؟`}
        confirmText="حفظ"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        title="تعطيل المنتج"
        description={`سيتم تعطيل "${deleteTarget?.name ?? ''}" ولن يظهر في فواتير البيع والشراء الجديدة. الفواتير السابقة لن تتأثر.`}
        confirmText="تعطيل"
        destructive
      />
    </div>
  );
}

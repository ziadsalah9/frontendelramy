import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, AlertTriangle, CheckCircle2, Info, Package, Boxes, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { productDraftsService } from '@/api/productDrafts';
import { extractApiError } from '@/api/client';
import type { ProductDraft, ProductDraftInput, ProductType } from '@/types';
import { useProductTypeOptions } from '@/hooks/useProductTypes';
import { TypeTabs } from '@/components/shared/TypeTabs';
import { inTypeTab, ALL_TYPES } from '@/utils/typeTabs';
import { PageHeader, ConfirmDialog } from '@/components/shared/States';
import { DataTable, SearchInput, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormInput, FormSelect, FormError } from '@/components/shared/Modal';
import { formatCurrency } from '@/utils/format';
import { sanitizeDecimal, sanitizeInt, matches, MAX_NAME, MAX_MODEL } from '@/utils/validation';
import { reprice, round2, type PriceAnchor } from '@/utils/pricing';
import { VariantsEditor } from '@/components/products/VariantsEditor';
import { FormSection } from '@/components/products/FormSection';
import { newVariantRow, duplicateVariantError, overTotalError, type VariantRow } from '@/utils/variants';

interface DraftForm {
  name: string;
  type: ProductType | '';
  model: string;
  /** Colours/sizes with their quantities (same editor as products). */
  variants: VariantRow[];
  minimumQuantity: string;
  basePrice: string;
  profitPercent: string;
  sellingPrice: string;
  /** Total available quantity (required to complete). */
  totalQuantity: string;
}

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

const toForm = (d: ProductDraft): DraftForm => ({
  name: d.name ?? '',
  type: d.itemType ?? '',
  model: d.model ?? '',
  variants: d.variants.length
    ? d.variants.map((v) => ({ key: `d-${v.id ?? Math.random()}`, id: v.id ?? undefined, color: v.color ?? '', size: v.size ?? '', qty: str(v.quantity) }))
    : [newVariantRow()],
  minimumQuantity: str(d.minimumQuantity),
  basePrice: str(d.purchasePrice),
  profitPercent: str(d.profitPercentage),
  sellingPrice: str(d.sellingPrice),
  totalQuantity: str(d.totalQuantity),
});

const toRequest = (f: DraftForm): ProductDraftInput => {
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    name: f.name.trim() || null,
    itemType: f.type || null,
    model: f.model.trim() || null,
    variants: f.variants.map((r) => ({ id: r.id ?? null, color: r.color || null, size: r.size || null, quantity: num(r.qty) })),
    minimumQuantity: num(f.minimumQuantity),
    purchasePrice: num(f.basePrice),
    profitPercentage: num(f.profitPercent),
    sellingPrice: num(f.sellingPrice),
    totalQuantity: num(f.totalQuantity),
  };
};

/**
 * Same rule as the backend (ProductFieldRules): complete = name, type,
 * price (cost + profit % or selling) and quantity (0 counts). Colour and
 * size are optional; this row becomes one colour/size of the product.
 */
const missingOf = (f: DraftForm): string[] => {
  const m: string[] = [];
  if (!f.name.trim()) m.push('الاسم');
  if (!f.type) m.push('النوع');
  const hasPrice = Number(f.basePrice) > 0 && (Number(f.sellingPrice) > 0 || f.profitPercent.trim() !== '');
  if (!hasPrice) m.push('السعر');
  if (f.variants.length === 0 || f.variants.some((r) => r.qty.trim() === '')) m.push('الكمية الحالية');
  if (f.totalQuantity.trim() === '' || overTotalError(f.variants, f.totalQuantity, true)) m.push('إجمالي الكمية');
  return m;
};

const DRAFT_KEYS = [['product-drafts'], ['product-drafts-count']] as const;

/**
 * "منتجات غير مكتملة": rows from Excel imports that were missing data.
 * They are not in the system (no sales, no stock, not in product lists)
 * until someone fills the gaps and adds them.
 */
export default function ProductDraftsPage() {
  const queryClient = useQueryClient();
  const [typeTab, setTypeTab] = useState(ALL_TYPES);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ProductDraft | null>(null);
  const [form, setForm] = useState<DraftForm | null>(null);
  const { options: typeOptions } = useProductTypeOptions(editing?.itemType);
  const [anchor, setAnchor] = useState<PriceAnchor>('profit');
  const [saving, setSaving] = useState<'draft' | 'complete' | null>(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProductDraft | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: drafts, isLoading, error: queryError } = useQuery({ queryKey: ['product-drafts'], queryFn: productDraftsService.getAll });

  const searched = (drafts ?? []).filter(
    (d) => matches(d.name, search) || matches(d.itemType, search) || matches(d.sourceFile, search)
      || d.variants.some((v) => matches(v.color, search) || matches(v.size, search)),
  );
  const filtered = searched.filter((d) => inTypeTab(typeTab, d.itemType));

  const refresh = () => DRAFT_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [...k] }));

  const openEdit = (d: ProductDraft) => {
    setEditing(d);
    setForm(toForm(d));
    setAnchor(d.sellingPrice != null && d.profitPercentage == null ? 'selling' : 'profit');
    setError('');
  };

  const close = () => {
    if (saving) return;
    setEditing(null);
    setForm(null);
  };

  const onPrice = (field: 'basePrice' | 'profitPercent' | 'sellingPrice', raw: string) => {
    const value = sanitizeDecimal(raw);
    const a: PriceAnchor = field === 'profitPercent' ? 'profit' : field === 'sellingPrice' ? 'selling' : anchor;
    setAnchor(a);
    setForm((f) => (f ? reprice({ ...f, [field]: value }, a) : f));
  };

  const validateTyped = (f: DraftForm): string | null => {
    const dup = duplicateVariantError(f.variants);
    if (dup) return dup;
    if (f.variants.length === 0) return 'أضف لوناً/مقاساً واحداً على الأقل';
    const over = overTotalError(f.variants, f.totalQuantity, true);
    if (over) return over;
    if (f.name.trim().length > MAX_NAME) return `الاسم يجب ألا يزيد عن ${MAX_NAME} حرف`;
    if (f.model.trim().length > MAX_MODEL) return `الموديل يجب ألا يزيد عن ${MAX_MODEL} حرف`;
    if (f.basePrice !== '' && !(Number(f.basePrice) > 0)) return 'سعر التكلفة يجب أن يكون أكبر من صفر';
    if (f.sellingPrice !== '' && !(Number(f.sellingPrice) > 0)) return 'سعر البيع يجب أن يكون أكبر من صفر';
    return null;
  };

  const save = async (andComplete: boolean) => {
    if (!editing || !form || saving) return;
    const typed = validateTyped(form);
    if (typed) {
      setError(typed);
      return;
    }
    if (andComplete && missingOf(form).length > 0) {
      setError(`أكمل أولاً: ${missingOf(form).join('، ')}`);
      return;
    }
    setSaving(andComplete ? 'complete' : 'draft');
    setError('');
    try {
      await productDraftsService.update(editing.id, toRequest(form));
      if (andComplete) {
        const product = await productDraftsService.complete(editing.id);
        toast.success(`تمت إضافة "${product.name}" إلى المنتجات`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      } else {
        toast.success('تم حفظ البيانات، المنتج ما زال غير مكتمل');
      }
      refresh();
      setEditing(null);
      setForm(null);
    } catch (err) {
      // The draft data may already be saved even if completing failed.
      refresh();
      setError(extractApiError(err).message);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await productDraftsService.remove(deleteTarget.id);
      toast.success('تم حذف المنتج غير المكتمل');
      refresh();
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<ProductDraft>[] = [
    {
      key: 'name', header: 'الاسم',
      render: (d) => (
        <div>
          {d.name ? <span className="font-medium">{d.name}</span> : <span className="text-muted-foreground italic">بدون اسم</span>}
          {d.sourceRow != null && <span className="block text-xs text-muted-foreground">الصف {d.sourceRow}{d.sourceFile ? ` · ${d.sourceFile}` : ''}</span>}
        </div>
      ),
    },
    { key: 'type', header: 'النوع', render: (d) => d.itemType ?? <span className="text-muted-foreground">-</span> },
    {
      key: 'variants', header: 'الألوان والمقاسات',
      render: (d) => (
        <div className="flex flex-wrap gap-1 max-w-[260px]">
          {d.variants.map((v, i) => (
            <span key={v.id ?? i} className="px-1.5 py-0.5 rounded bg-muted text-xs whitespace-nowrap">
              {[v.color, v.size].filter(Boolean).join(' / ') || 'بدون لون أو مقاس'}: {v.quantity ?? '؟'}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'missing', header: 'البيانات الناقصة',
      render: (d) => (
        <div className="flex flex-wrap gap-1">
          {d.missingFields.length === 0
            ? <Badge variant="success">مكتمل، جاهز للإضافة</Badge>
            : d.missingFields.map((m) => <Badge key={m} variant="warning">{m}</Badge>)}
        </div>
      ),
    },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left w-px',
      render: (d) => (
        <div className="flex items-center gap-1">
          <ActionButton onClick={() => openEdit(d)} icon={Pencil} label="إكمال البيانات" />
          <ActionButton onClick={() => setDeleteTarget(d)} icon={Trash2} label="حذف" variant="destructive" />
        </div>
      ),
    },
  ];

  const missing = form ? missingOf(form) : [];
  const busy = saving !== null;

  return (
    <div>
      <PageHeader
        title="منتجات غير مكتملة"
        description="منتجات من ملفات Excel تنقصها بيانات. لا تظهر في البيع أو المخزون حتى يتم إكمالها وإضافتها."
      />

      <div className="mb-3"><SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو النوع أو اسم الملف..." /></div>
      <div className="mb-4"><TypeTabs types={searched.map((d) => d.itemType)} value={typeTab} onChange={setTypeTab} idPrefix="drafts-type" /></div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        error={queryError ? extractApiError(queryError).message : null}
        emptyTitle={search ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات غير مكتملة'}
        emptyDescription={search ? 'جرّب كلمة بحث أخرى' : 'المنتجات الناقصة من ملفات Excel ستظهر هنا'}
      />

      <Modal open={!!editing && !!form} onClose={close} title="إكمال بيانات المنتج" maxWidth="max-w-3xl" persistent busy={busy}>
        {editing && form && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              هذا الصف يمثل لوناً/مقاساً واحداً. إذا كان المنتج (نفس الاسم والنوع والموديل) موجوداً بالفعل، سيُضاف إليه هذا اللون/المقاس بدلاً من إنشاء منتج جديد.
            </p>
            {editing.notes.length > 0 && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm space-y-1">
                <p className="flex items-center gap-1.5 font-medium text-foreground"><Info className="w-4 h-4 text-warning" /> قيم تم مسحها أثناء الاستيراد:</p>
                <ul className="list-disc pr-5 text-muted-foreground">
                  {editing.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            <FormSection icon={Package} title="البيانات الأساسية">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="اسم المنتج" maxLength={MAX_NAME} />
                <FormSelect label="النوع" value={form.type} onChange={(v) => setForm({ ...form, type: v as ProductType })} options={typeOptions} required placeholder="اختر النوع" />
                <FormInput label="الموديل" value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="اختياري" maxLength={MAX_MODEL} />
                <FormInput label="الحد الأدنى للكمية (تنبيه)" type="text" inputMode="numeric" value={form.minimumQuantity} onChange={(v) => setForm({ ...form, minimumQuantity: sanitizeInt(v) })} placeholder="اختياري" dir="ltr" />
              </div>
            </FormSection>

            <FormSection icon={Boxes} title="الكمية والألوان والمقاسات" hint="اكتب إجمالي الكمية ثم وزّعها. تُسجَّل كرصيد افتتاحي عند الإضافة للمنتجات.">
              <VariantsEditor
                draft
                rows={form.variants}
                onChange={(rows) => setForm({ ...form, variants: rows })}
                total={form.totalQuantity}
                onTotalChange={(v) => setForm({ ...form, totalQuantity: v })}
              />
            </FormSection>

            <FormSection icon={Tags} title="التسعير" hint="أدخل سعر التكلفة ثم نسبة الربح أو سعر البيع، ويُحسب الآخر تلقائياً.">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormInput label="سعر التكلفة" type="text" inputMode="decimal" value={form.basePrice} onChange={(v) => onPrice('basePrice', v)} required placeholder="0.00" dir="ltr" />
                <FormInput label={anchor === 'selling' ? 'نسبة الربح % (محسوبة)' : 'نسبة الربح %'} type="text" inputMode="decimal" value={form.profitPercent} onChange={(v) => onPrice('profitPercent', v)} placeholder="مثال: 30" dir="ltr" />
                <FormInput label={anchor === 'profit' ? 'سعر البيع (محسوب)' : 'سعر البيع'} type="text" inputMode="decimal" value={form.sellingPrice} onChange={(v) => onPrice('sellingPrice', v)} placeholder="0.00" dir="ltr" />
              </div>
              {Number(form.basePrice) > 0 && Number(form.sellingPrice) > 0 && (
                <p className={`text-sm ${Number(form.sellingPrice) < Number(form.basePrice) ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                  الربح للوحدة: <span className="font-semibold">{formatCurrency(round2(Number(form.sellingPrice) - Number(form.basePrice)))} ج.م</span>
                  {Number(form.sellingPrice) < Number(form.basePrice) && ' (سعر البيع أقل من سعر التكلفة)'}
                </p>
              )}
            </FormSection>

            {missing.length > 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-warning"><AlertTriangle className="w-4 h-4" /> ناقص: {missing.join('، ')}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="w-4 h-4" /> البيانات مكتملة، يمكن إضافة المنتج للنظام.</p>
            )}

            <FormError message={error} />

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={close} disabled={busy} className="h-10 px-4 rounded-lg border border-input text-sm hover:bg-accent disabled:opacity-50">إلغاء</button>
              <button type="button" onClick={() => void save(false)} disabled={busy} className="h-10 px-4 rounded-lg border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50">
                {saving === 'draft' ? 'جاري الحفظ...' : 'حفظ كمسودة'}
              </button>
              <button type="button" onClick={() => void save(true)} disabled={busy || missing.length > 0} title={missing.length > 0 ? `ناقص: ${missing.join('، ')}` : undefined} className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {saving === 'complete' ? 'جاري الإضافة...' : 'إضافة للمنتجات'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        title="حذف المنتج غير المكتمل"
        description={`سيتم حذف "${deleteTarget?.name ?? 'بدون اسم'}" نهائياً من المنتجات غير المكتملة. لن يؤثر ذلك على المنتجات الموجودة في النظام.`}
        confirmText="حذف"
        destructive
      />
    </div>
  );
}

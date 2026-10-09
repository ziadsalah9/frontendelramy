import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tags, Save, Loader2 } from 'lucide-react';
import { productsService, productPricesService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { Product } from '@/types';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '@/components/shared/States';
import { SearchInput } from '@/components/shared/DataTable';
import { FormInput, FormError } from '@/components/shared/Modal';
import { formatCurrency } from '@/utils/format';
import { sanitizeDecimal, matches } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const EMPTY_FORM = { purchasePrice: '', profitPercentage: '', sellingPrice: '' };

export default function ProductPricesPage() {
  const queryClient = useQueryClient();
  // Reading a price is open to every role, but POST/PATCH /{id}/price are
  // ADMIN-only, so employees get the prices without the edit form.
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceMode, setPriceMode] = useState<'profit' | 'selling'>('profit');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: products, isLoading, error: queryError } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const { data: currentPrice, isLoading: priceLoading, error: priceError } = useQuery({
    queryKey: ['product-price', selectedProduct?.id],
    queryFn: () => productPricesService.getPrice(selectedProduct!.id),
    enabled: !!selectedProduct,
    // A 404 here just means the product has never been priced, so it
    // must not be surfaced as a failed query.
    retry: false,
  });

  const hasPrice = !!currentPrice;
  // Only a 404 means "never priced". Any other failure must not be read as
  // "no price" - that would offer to create one over an existing price.
  const priceMissing = !!priceError && extractApiError(priceError).status === 404;
  const priceLoadFailed = !!priceError && !priceMissing;

  // Seed the form from the product's existing price so editing starts
  // from the real numbers instead of zero.
  useEffect(() => {
    if (currentPrice) {
      // A price entered as a selling price has no profit %: edit it in
      // the same mode, or saving would send profit 0 (price = cost).
      const bySelling = currentPrice.profitPercentage == null;
      setPriceMode(bySelling ? 'selling' : 'profit');
      setForm({
        purchasePrice: String(currentPrice.purchasePrice ?? 0),
        profitPercentage: bySelling ? '' : String(currentPrice.profitPercentage),
        sellingPrice: String(currentPrice.sellingPrice ?? 0),
      });
    } else {
      setPriceMode('profit');
      setForm(EMPTY_FORM);
    }
  }, [currentPrice]);

  const filtered = (products ?? []).filter(
    (p) =>
      matches(p.name, search) ||
      matches(p.code, search) ||
      matches(p.itemType, search) ||
      p.variants.some((v) => matches(v.label, search)),
  );

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || loading) return;
    // Mirrors ProductServiceImpl: purchase price > 0, and either a
    // profit % >= 0 or a selling price > 0 (never both).
    const purchase = Number(form.purchasePrice);
    if (!(purchase > 0)) {
      setError('سعر الشراء يجب أن يكون أكبر من صفر');
      return;
    }
    if (priceMode === 'profit' && (form.profitPercentage.trim() === '' || !(Number(form.profitPercentage) >= 0))) {
      setError('أدخل نسبة ربح صحيحة (0 أو أكثر)');
      return;
    }
    if (priceMode === 'selling' && !(Number(form.sellingPrice) > 0)) {
      setError('سعر البيع يجب أن يكون أكبر من صفر');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = priceMode === 'profit'
        ? { purchasePrice: Number(form.purchasePrice), profitPercentage: Number(form.profitPercentage) }
        : { purchasePrice: Number(form.purchasePrice), sellingPrice: Number(form.sellingPrice) };

      // One call sets the price, whether it's the first one or a change.
      await productPricesService.setPrice(selectedProduct.id, payload);

      toast.success('تم تحديث السعر بنجاح');
      queryClient.invalidateQueries({ queryKey: ['product-price', selectedProduct.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const calculatedSelling = priceMode === 'profit'
    ? Number(form.purchasePrice) * (1 + (Number(form.profitPercentage) || 0) / 100)
    : Number(form.sellingPrice) || 0;
  const calculatedProfit = calculatedSelling - (Number(form.purchasePrice) || 0);

  return (
    <div>
      <PageHeader title="الأسعار" description="إدارة أسعار المنتجات" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product list */}
        <div className="lg:col-span-1">
          <div className="mb-3"><SearchInput value={search} onChange={setSearch} placeholder="بحث عن منتج..." /></div>
          <div className="border rounded-xl bg-card max-h-[600px] overflow-y-auto">
            {isLoading ? <LoadingState /> : queryError ? <ErrorState message={extractApiError(queryError).message} /> : filtered.length === 0 ? <EmptyState title="لا توجد منتجات" /> : (
              <div className="divide-y">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={`w-full text-right px-4 py-3 hover:bg-muted/30 transition-colors ${selectedProduct?.id === p.id ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                  >
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.itemType ?? ''}{p.variants.length > 1 ? ` · ${p.variants.length} ألوان/مقاسات` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Price panel */}
        <div className="lg:col-span-2">
          {!selectedProduct ? (
            <div className="border rounded-xl bg-card p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><Tags className="w-8 h-8 text-muted-foreground" /></div>
              <h3 className="font-semibold text-foreground mb-1">اختر منتجاً</h3>
              <p className="text-sm text-muted-foreground">اختر منتجاً من القائمة لعرض وتعديل سعره</p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-foreground">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedProduct.itemType ?? ''} · السعر واحد لكل الألوان والمقاسات ({selectedProduct.variants.map((v) => v.label).join('، ')})</p>
                </div>
              </div>

              {/* Current price */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">سعر الشراء</p><p className="text-lg font-bold text-foreground">{currentPrice ? formatCurrency(currentPrice.purchasePrice) : '-'} ج.م</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">سعر البيع</p><p className="text-lg font-bold text-primary">{currentPrice ? formatCurrency(currentPrice.sellingPrice) : '-'} ج.م</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">نسبة الربح</p><p className="text-lg font-bold text-success">{currentPrice?.profitPercentage ?? '-'}%</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الربح</p><p className="text-lg font-bold text-foreground">{currentPrice ? formatCurrency(currentPrice.sellingPrice - currentPrice.purchasePrice) : '-'} ج.م</p></div>
              </div>

              {priceMissing && (
                <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-foreground">
                  لا يوجد سعر مسجل لهذا المنتج بعد. أدخل السعر الجديد وسيتم إنشاؤه.
                </div>
              )}

              {priceLoading ? <LoadingState /> : priceLoadFailed ? (
                <ErrorState message={`تعذر تحميل السعر الحالي: ${extractApiError(priceError).message}`} />
              ) : !isAdmin ? (
                <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
                  الأسعار للعرض فقط — تعديل الأسعار متاح لمدير النظام.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                    <button type="button" onClick={() => { setPriceMode('profit'); setError(''); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${priceMode === 'profit' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}>سعر الشراء + نسبة الربح</button>
                    <button type="button" onClick={() => { setPriceMode('selling'); setError(''); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${priceMode === 'selling' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}>سعر الشراء + سعر البيع</button>
                  </div>

                  <FormError message={error} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormInput label="سعر الشراء" type="text" inputMode="decimal" value={form.purchasePrice} onChange={(v) => setForm({ ...form, purchasePrice: sanitizeDecimal(v) })} required dir="ltr" />
                    {priceMode === 'profit' ? (
                      <FormInput label="نسبة الربح (%)" type="text" inputMode="decimal" value={form.profitPercentage} onChange={(v) => setForm({ ...form, profitPercentage: sanitizeDecimal(v) })} required dir="ltr" />
                    ) : (
                      <FormInput label="سعر البيع" type="text" inputMode="decimal" value={form.sellingPrice} onChange={(v) => setForm({ ...form, sellingPrice: sanitizeDecimal(v) })} required dir="ltr" />
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">سعر البيع المتوقع</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(calculatedSelling)} ج.م</p>
                    {Number(form.purchasePrice) > 0 && (
                      <p className={`text-xs mt-1 ${calculatedProfit < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {calculatedProfit < 0 ? 'تنبيه: سعر البيع أقل من سعر الشراء - ' : 'الربح للوحدة: '}
                        {formatCurrency(calculatedProfit)} ج.م
                      </p>
                    )}
                  </div>

                  <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {loading ? 'جاري الحفظ...' : hasPrice ? 'حفظ السعر' : 'إنشاء السعر'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}